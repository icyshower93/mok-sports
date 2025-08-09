# Production Testing Guidelines for Mok Sports PWA

## Development & OAuth Setup

### Google OAuth Configuration
Add both redirect URIs to your Google Cloud Console:

**Development (Stable Domain):**
```
https://92ffc405-08e6-4ad1-b9df-e636cad26194-00-3jkv8o13s49g2.spock.replit.dev/api/auth/google/callback
```

**Production:**
```
https://mok-sports-draft-mokfantasysport.replit.app/api/auth/google/callback
```

## Three-Stage Development Workflow

### Stage 1: Development Testing
- **URL**: `https://92ffc405-08e6-4ad1-b9df-e636cad26194-00-3jkv8o13s49g2.spock.replit.dev`
- **Features**: Full OAuth functionality, database access, WebSocket testing
- **Purpose**: Primary development and feature testing
- **Benefits**: Stable URL, complete feature set, no deployment needed

### Stage 2: Production Validation
- **URL**: `https://mok-sports-draft-mokfantasysport.replit.app`
- **Purpose**: Final validation before release
- **Test**: Real user scenarios, performance under load
- **Duration**: Quick validation, not extended development

### Stage 3: Release
- **Action**: Deploy final version once satisfied
- **Result**: Automatic PWA updates for all users

## Production Maintenance Guidelines

### Daily Operations
- **Monitor**: Check WebSocket connection metrics in logs
- **Database**: Monitor PostgreSQL performance and storage
- **Push Notifications**: Verify VAPID keys and notification delivery
- **Cache**: Service worker automatically handles cache invalidation

### Update Deployment Strategy

#### For Bug Fixes (Immediate)
1. Code fix in development environment
2. Test thoroughly with OAuth working
3. Deploy via Replit Deploy button
4. Users receive update within 5-10 minutes automatically
5. No user action required

#### For New Features (Planned)
1. Develop and test extensively in stable development environment
2. Consider timing (avoid during active drafts)
3. Deploy during off-peak hours when possible
4. Monitor post-deployment for any issues

#### For Critical Fixes (Emergency)
1. Can deploy immediately - PWA handles graceful updates
2. Active draft sessions won't be interrupted
3. WebSocket connections gracefully reconnect
4. Database state remains consistent

### User Experience During Updates
- **No Reinstallation**: Users never need to delete/reinstall PWA
- **Seamless Updates**: Service worker handles everything automatically
- **Background Downloads**: New versions download while app is closed
- **Instant Activation**: Next app open uses new version
- **State Preservation**: Draft progress, login status maintained

### Monitoring & Health Checks

#### Key Metrics to Watch
- WebSocket connection success rate
- Database query performance
- Push notification delivery rates
- Service worker cache hit rates
- OAuth authentication success rate

#### Health Check Endpoints
- `/api/health` - Overall system health
- Database connectivity automatically monitored
- Redis state management status
- VAPID key validation

### Best Practices for Live Users

#### Communication
- Major updates can be announced via push notifications
- Critical maintenance windows should be communicated in advance
- Use in-app banners for important user messages

#### Data Safety
- Database migrations handled automatically by Drizzle
- Always backup before major schema changes
- User draft state persists across all updates
- League data remains intact during updates

#### Performance Optimization
- Service worker caches static assets aggressively
- Database connection pooling handles user load
- WebSocket connections scale with Reserved VM
- Push notifications are rate-limited and batched

### Emergency Procedures

#### If App Goes Down
1. Check Replit deployment status
2. Verify database connectivity
3. Check WebSocket server status
4. Review recent deployment logs

#### If OAuth Breaks
1. Verify Google OAuth credentials in secrets
2. Check redirect URI configuration
3. Validate domain settings in Google Console
4. Test authentication flow in development first

#### If WebSocket Issues
1. Monitor connection metrics in logs
2. Check Redis connectivity
3. Verify draft state consistency
4. Test real-time features thoroughly

### Scaling Considerations

#### User Growth
- PostgreSQL can handle thousands of concurrent users
- WebSocket connections scale with Reserved VM capacity
- Push notifications are optimized for batch delivery
- Service worker reduces server load through caching

#### Feature Additions
- New API endpoints can be added without breaking existing functionality
- Database schema changes are handled seamlessly
- PWA manifest updates deploy automatically
- Service worker cache strategies accommodate new assets

### Long-term Maintenance

#### Regular Tasks
- Monitor database storage usage
- Review and clean up old draft data if needed
- Update dependencies periodically in development
- Review push notification delivery rates

#### Security Updates
- Google OAuth tokens are refreshed automatically
- JWT secrets should be rotated periodically
- Database credentials managed by Replit
- HTTPS enforced for all production traffic

## Summary

Your PWA is designed for zero-downtime updates and seamless user experience. The service worker architecture ensures users always get the latest version without any manual intervention. Focus on thorough testing in the stable development environment, then deploy with confidence knowing users will receive updates automatically.