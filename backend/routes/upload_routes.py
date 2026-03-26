"""
File Upload Routes - Handle file uploads for RM requests (artwork files)
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
from pathlib import Path
from services.auth_service import get_current_user
from models.auth import User

router = APIRouter(prefix="/uploads", tags=["File Uploads"])

# Upload directory
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "rm_artwork"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file extensions for artwork
ALLOWED_EXTENSIONS = {".ai", ".pdf", ".cdr", ".eps", ".svg", ".psd"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def get_file_extension(filename: str) -> str:
    """Get lowercase file extension"""
    return os.path.splitext(filename)[1].lower()


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


@router.post("/rm-artwork")
async def upload_rm_artwork(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload artwork files for RM requests.
    Accepts: .ai, .pdf, .cdr, .eps, .svg, .psd
    Max size: 50MB per file
    """
    uploaded_files = []
    errors = []
    
    for file in files:
        # Validate file extension
        if not is_allowed_file(file.filename):
            errors.append({
                "filename": file.filename,
                "error": f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            })
            continue
        
        # Read file content
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_FILE_SIZE:
            errors.append({
                "filename": file.filename,
                "error": f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB"
            })
            continue
        
        # Generate unique filename
        file_ext = get_file_extension(file.filename)
        unique_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{unique_id}{file_ext}"
        
        # Save file
        file_path = UPLOAD_DIR / safe_filename
        try:
            with open(file_path, "wb") as f:
                f.write(content)
            
            uploaded_files.append({
                "id": unique_id,
                "original_name": file.filename,
                "stored_name": safe_filename,
                "file_type": file_ext[1:].upper(),  # Remove dot, uppercase
                "size": len(content),
                "size_display": f"{len(content) / 1024:.1f} KB" if len(content) < 1024*1024 else f"{len(content) / (1024*1024):.1f} MB",
                "uploaded_by": current_user.id,
                "uploaded_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return {
        "uploaded": uploaded_files,
        "errors": errors,
        "total_uploaded": len(uploaded_files),
        "total_errors": len(errors)
    }


@router.get("/rm-artwork/{filename}")
async def get_rm_artwork(filename: str):
    """Download/view an uploaded artwork file"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    ext = get_file_extension(filename)
    content_types = {
        ".pdf": "application/pdf",
        ".ai": "application/postscript",
        ".cdr": "application/octet-stream",
        ".eps": "application/postscript",
        ".svg": "image/svg+xml",
        ".psd": "image/vnd.adobe.photoshop"
    }
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=content_types.get(ext, "application/octet-stream")
    )


@router.delete("/rm-artwork/{filename}")
async def delete_rm_artwork(filename: str, current_user: User = Depends(get_current_user)):
    """Delete an uploaded artwork file"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        os.remove(file_path)
        return {"message": "File deleted", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
