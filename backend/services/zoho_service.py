"""
Zoho Books Integration Service
- Handles OAuth token refresh
- Creates bills in Zoho Books when RM Inward is recorded
"""
import httpx
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class ZohoTokenManager:
    """Manages Zoho OAuth tokens with automatic refresh."""
    
    def __init__(self):
        self.client_id = os.environ.get("ZOHO_CLIENT_ID")
        self.client_secret = os.environ.get("ZOHO_CLIENT_SECRET")
        self.refresh_token = os.environ.get("ZOHO_REFRESH_TOKEN")
        self.accounts_url = "https://accounts.zoho.in"
        
        self.access_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
    
    def _is_token_expired(self) -> bool:
        """Check if current access token is expired."""
        if self.token_expiry is None or self.access_token is None:
            return True
        # Refresh 5 minutes before expiry for safety
        return datetime.now() >= (self.token_expiry - timedelta(minutes=5))
    
    async def _refresh_access_token(self) -> bool:
        """Refresh the access token using the refresh token."""
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            logger.error("Zoho credentials not configured")
            return False
        
        try:
            url = f"{self.accounts_url}/oauth/v2/token"
            payload = {
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.refresh_token
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(url, data=payload)
                response.raise_for_status()
                
                data = response.json()
                
                if "error" in data:
                    logger.error(f"Zoho token refresh error: {data.get('error')}")
                    return False
                
                self.access_token = data.get("access_token")
                # Access tokens are valid for 3600 seconds (1 hour)
                self.token_expiry = datetime.now() + timedelta(seconds=3600)
                
                logger.info("Zoho access token refreshed successfully")
                return True
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to refresh Zoho access token: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error refreshing Zoho token: {str(e)}")
            return False
    
    async def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary."""
        if self._is_token_expired():
            success = await self._refresh_access_token()
            if not success:
                raise Exception("Failed to obtain valid Zoho access token")
        
        return self.access_token
    
    async def get_authorization_header(self) -> Dict[str, str]:
        """Get the authorization header for API requests."""
        token = await self.get_access_token()
        return {
            "Authorization": f"Zoho-oauthtoken {token}"
        }


class ZohoBooksClient:
    """Client for interacting with Zoho Books API."""
    
    def __init__(self):
        self.organization_id = os.environ.get("ZOHO_ORGANIZATION_ID")
        self.api_domain = os.environ.get("ZOHO_API_DOMAIN", "https://www.zohoapis.in")
        self.base_url = f"{self.api_domain}/books/v3"
        self.token_manager = ZohoTokenManager()
    
    def is_configured(self) -> bool:
        """Check if Zoho integration is properly configured."""
        return all([
            self.organization_id,
            self.token_manager.client_id,
            self.token_manager.client_secret,
            self.token_manager.refresh_token
        ])
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an authenticated request to Zoho Books API."""
        url = f"{self.base_url}/{endpoint}"
        
        # Add organization_id to params
        if params is None:
            params = {}
        params["organization_id"] = self.organization_id
        
        headers = await self.token_manager.get_authorization_header()
        headers["Content-Type"] = "application/json"
        
        async with httpx.AsyncClient(timeout=60) as client:
            if method.upper() == "POST":
                response = await client.post(url, json=json_data, params=params, headers=headers)
            elif method.upper() == "GET":
                response = await client.get(url, params=params, headers=headers)
            elif method.upper() == "PUT":
                response = await client.put(url, json=json_data, params=params, headers=headers)
            elif method.upper() == "DELETE":
                response = await client.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Parse response
            try:
                result = response.json()
            except:
                result = {"raw_response": response.text}
            
            # Check for errors
            if response.status_code >= 400:
                error_msg = result.get("message", response.text)
                logger.error(f"Zoho API error ({response.status_code}): {error_msg}")
                raise Exception(f"Zoho API error: {error_msg}")
            
            return result
    
    async def create_bill(
        self,
        vendor_id: str,
        vendor_name: str,
        bill_number: str,
        bill_date: str,
        line_items: list,
        reference_number: Optional[str] = None,
        notes: Optional[str] = None,
        due_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a bill (purchase invoice) in Zoho Books.
        
        Args:
            vendor_id: Zoho vendor ID (must exist in Zoho Books)
            vendor_name: Vendor name for reference
            bill_number: Unique bill number
            bill_date: Bill date in YYYY-MM-DD format
            line_items: List of line items with name, quantity, rate
            reference_number: Optional reference/PO number
            notes: Optional notes
            due_date: Optional due date in YYYY-MM-DD format
        
        Returns:
            Dict containing created bill details including bill_id
        """
        # Build line items for Zoho
        zoho_line_items = []
        for item in line_items:
            line = {
                "name": item.get("description") or item.get("rm_id", "Item"),
                "description": f"RM: {item.get('rm_id', '')} - {item.get('description', '')}",
                "quantity": float(item.get("quantity", 1)),
                "rate": float(item.get("rate", 0)),
            }
            
            # Add HSN if available
            if item.get("hsn"):
                line["hsn_or_sac"] = item.get("hsn")
            
            # Add tax if available
            if item.get("tax") and item.get("tax") != "NONE":
                line["tax_name"] = item.get("tax")
            
            zoho_line_items.append(line)
        
        # Build bill payload
        payload = {
            "vendor_id": vendor_id,
            "bill_number": bill_number,
            "date": bill_date,
            "line_items": zoho_line_items
        }
        
        if reference_number:
            payload["reference_number"] = reference_number
        if notes:
            payload["notes"] = notes
        if due_date:
            payload["due_date"] = due_date
        
        logger.info(f"Creating Zoho bill: {bill_number} for vendor {vendor_name}")
        
        result = await self._make_request("POST", "bills", json_data=payload)
        
        if result.get("code") == 0:
            bill = result.get("bill", {})
            logger.info(f"Zoho bill created successfully: {bill.get('bill_id')}")
            return {
                "success": True,
                "zoho_bill_id": bill.get("bill_id"),
                "zoho_bill_number": bill.get("bill_number"),
                "zoho_bill_status": bill.get("status"),
                "zoho_response": bill
            }
        else:
            error_msg = result.get("message", "Unknown error")
            logger.error(f"Zoho bill creation failed: {error_msg}")
            raise Exception(f"Zoho bill creation failed: {error_msg}")
    
    async def get_vendor_by_name(self, vendor_name: str) -> Optional[Dict]:
        """Search for a vendor by name in Zoho Books."""
        try:
            result = await self._make_request(
                "GET", 
                "contacts", 
                params={"contact_name": vendor_name, "contact_type": "vendor"}
            )
            
            contacts = result.get("contacts", [])
            if contacts:
                return contacts[0]
            return None
        except Exception as e:
            logger.warning(f"Failed to find vendor in Zoho: {str(e)}")
            return None
    
    async def create_vendor(self, vendor_name: str, email: Optional[str] = None) -> Dict:
        """Create a vendor in Zoho Books if it doesn't exist."""
        payload = {
            "contact_name": vendor_name,
            "contact_type": "vendor"
        }
        
        if email:
            payload["email"] = email
        
        result = await self._make_request("POST", "contacts", json_data=payload)
        
        if result.get("code") == 0:
            contact = result.get("contact", {})
            logger.info(f"Zoho vendor created: {contact.get('contact_id')}")
            return contact
        else:
            raise Exception(f"Failed to create vendor: {result.get('message')}")
    
    async def get_or_create_vendor(self, vendor_name: str) -> str:
        """Get existing vendor ID or create new vendor in Zoho Books."""
        # Try to find existing vendor
        vendor = await self.get_vendor_by_name(vendor_name)
        
        if vendor:
            return vendor.get("contact_id")
        
        # Create new vendor
        new_vendor = await self.create_vendor(vendor_name)
        return new_vendor.get("contact_id")


# Global client instance
zoho_client = ZohoBooksClient()
