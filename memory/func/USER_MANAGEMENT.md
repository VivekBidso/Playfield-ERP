# User Management

**Route**: `/user-management`  
**Access**: MASTER_ADMIN only  
**Frontend**: `/app/frontend/src/pages/UserManagement.js`

---

## Overview

Manages system users, roles, and permissions. RBAC administration.

---

## Key Features

### User List
- View all users
- Filter by role
- Search by name/email
- User status: ACTIVE/INACTIVE

### User CRUD
- Create new users
- Edit user details
- Assign roles
- Reset passwords
- Deactivate users

### Role Management
- View available roles
- Role descriptions
- Role permissions

### Protected Users
- System/test users cannot be deleted
- Protected: admin@factory.com, demandplanner@bidso.com, etc.

---

## Available Roles

| Code | Name |
|------|------|
| MASTER_ADMIN | Master Admin |
| TECH_OPS_ENGINEER | Tech Ops Engineer |
| DEMAND_PLANNER | Demand Planner |
| CPC_PLANNER | CPC Planner |
| PROCUREMENT_OFFICER | Procurement Officer |
| BRANCH_OPS_USER | Branch Ops User |
| FINANCE_VIEWER | Finance Viewer |
| QUALITY_INSPECTOR | Quality Inspector |
| LOGISTICS_COORDINATOR | Logistics Coordinator |
| AUDITOR_READONLY | Auditor (Read Only) |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/{id}` | Update user |
| DELETE | `/api/users/{id}` | Delete user (protected check) |
| GET | `/api/roles` | List roles |
| POST | `/api/users/{id}/roles` | Assign roles |

---

## Database Collections

- `users`
- `roles`
- `role_permissions`
- `permissions`

---

## Key Files

- **Frontend**: `/app/frontend/src/pages/UserManagement.js`
- **Backend**: `/app/backend/routes/auth_routes.py`
- **Service**: `/app/backend/services/auth_service.py`

---

## Password Hashing

⚠️ Uses **SHA256** hashing (non-standard). See `auth_service.py`.

