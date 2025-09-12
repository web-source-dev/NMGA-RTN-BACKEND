# Authentication Middleware System

This middleware system provides comprehensive authentication and authorization for the NMGA application, including support for admin impersonation of other users.

## Backend Middleware

### Available Middleware Functions

#### 1. `isAuthenticated`
Basic authentication middleware that checks if a user is authenticated.

```javascript
const { isAuthenticated } = require('../middleware/auth');

router.get('/protected-route', isAuthenticated, (req, res) => {
  // Route logic here
});
```

#### 2. `isAdmin`
Middleware that requires admin privileges.

```javascript
const { isAdmin } = require('../middleware/auth');

router.get('/admin-only', isAdmin, (req, res) => {
  // Admin only logic here
});
```

#### 3. `isDistributorAdmin`
Middleware that allows both distributor and admin access. If an admin is impersonating a distributor, the admin will have distributor privileges.

```javascript
const { isDistributorAdmin } = require('../middleware/auth');

router.get('/distributor-features', isDistributorAdmin, (req, res) => {
  // Distributor and admin logic here
});
```

#### 4. `isMemberAdmin`
Middleware that allows both member and admin access. If an admin is impersonating a member, the admin will have member privileges.

```javascript
const { isMemberAdmin } = require('../middleware/auth');

router.get('/member-features', isMemberAdmin, (req, res) => {
  // Member and admin logic here
});
```

### Getting User Context

Use `getCurrentUserContext(req)` to get the current user context, which handles impersonation:

```javascript
const { getCurrentUserContext } = require('../middleware/auth');

router.get('/user-info', isAuthenticated, (req, res) => {
  const userContext = getCurrentUserContext(req);
  
  res.json({
    currentUser: userContext.currentUser, // The effective user (impersonated or real)
    originalUser: userContext.originalUser, // The original user (if impersonating)
    isImpersonating: userContext.isImpersonating,
    adminId: userContext.adminId // Admin's ID if impersonating
  });
});
```

## Frontend Middleware

### Available Middleware Functions

#### 1. `requireAuth`
Higher-order component that requires authentication.

```javascript
import { requireAuth } from '../middleware/auth';

const ProtectedComponent = requireAuth(MyComponent);
```

#### 2. `requireAdmin`
Higher-order component that requires admin privileges.

```javascript
import { requireAdmin } from '../middleware/auth';

const AdminOnlyComponent = requireAdmin(MyComponent);
```

#### 3. `requireDistributorAdmin`
Higher-order component that allows distributor and admin access.

```javascript
import { requireDistributorAdmin } from '../middleware/auth';

const DistributorAdminComponent = requireDistributorAdmin(MyComponent);
```

#### 4. `requireMemberAdmin`
Higher-order component that allows member and admin access.

```javascript
import { requireMemberAdmin } from '../middleware/auth';

const MemberAdminComponent = requireMemberAdmin(MyComponent);
```

### Using the useAuth Hook

```javascript
import { useAuth } from '../middleware/auth';

const MyComponent = () => {
  const { 
    isAuthenticated, 
    isAdmin, 
    isDistributor, 
    isMember, 
    isImpersonating,
    currentUserId,
    originalUserId,
    userContext 
  } = useAuth();

  return (
    <div>
      {isImpersonating && (
        <div>Currently impersonating user: {currentUserId}</div>
      )}
      {/* Component logic */}
    </div>
  );
};
```

### Using ProtectedRoute Component

```javascript
import ProtectedRoute from '../components/ProtectedRoute';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin>
              <AdminComponent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/distributor" 
          element={
            <ProtectedRoute requireDistributorAdmin>
              <DistributorComponent />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
};
```

## Admin Impersonation

### How It Works

1. **Admin Login as User**: When an admin uses the "Login as User" feature, a special token is generated that includes impersonation information.

2. **Token Structure**: The token contains:
   - `id`: The user being impersonated
   - `role`: The user's role
   - `impersonatedUserId`: The user being impersonated
   - `isImpersonating`: true
   - `adminId`: The admin's original ID

3. **Middleware Behavior**: When using `isDistributorAdmin` or `isMemberAdmin`, if an admin is impersonating a user, the middleware will use the impersonated user's context.

### Example Usage

```javascript
// Backend route
router.get('/distributor-dashboard', isDistributorAdmin, (req, res) => {
  const userContext = getCurrentUserContext(req);
  
  // userContext.currentUser will be the distributor (even if admin is impersonating)
  // userContext.isImpersonating will be true if admin is impersonating
  
  res.json({
    dashboard: 'distributor-dashboard',
    user: userContext.currentUser,
    isImpersonating: userContext.isImpersonating
  });
});
```

```javascript
// Frontend component
const DistributorDashboard = () => {
  const { currentUserId, isImpersonating, userContext } = useAuth();
  
  return (
    <div>
      {isImpersonating && (
        <Alert severity="info">
          You are currently impersonating user: {userContext.impersonatedUserId}
        </Alert>
      )}
      <Dashboard userId={currentUserId} />
    </div>
  );
};
```

## API Integration

The API service automatically includes the authentication token in all requests:

```javascript
import api from '../services/api';

// Token is automatically included
const response = await api.get('/protected-route');
```

## Utility Functions

### Backend
- `getCurrentUserContext(req)`: Get current user context with impersonation support

### Frontend
- `isAuthenticated()`: Check if user is authenticated
- `isAdmin()`: Check if user is admin
- `isDistributor()`: Check if user is distributor
- `isMember()`: Check if user is member
- `isImpersonating()`: Check if admin is impersonating another user
- `getEffectiveUserId()`: Get the effective user ID (impersonated or current)
- `getEffectiveUserRole()`: Get the effective user role
- `canAccess(requiredRole, allowImpersonation)`: Check if user can access a feature

## Security Considerations

1. **Token Expiration**: Tokens expire after 1 hour
2. **User Blocking**: Blocked users cannot access any routes
3. **Role Validation**: Middleware validates user roles before allowing access
4. **Impersonation Logging**: All admin impersonation actions are logged
5. **Token Verification**: All tokens are verified against the database

## Error Handling

The middleware automatically handles:
- Missing tokens (401 Unauthorized)
- Invalid tokens (401 Unauthorized)
- Insufficient privileges (403 Forbidden)
- Blocked users (403 Forbidden)
- Token expiration (401 Unauthorized with automatic logout)
