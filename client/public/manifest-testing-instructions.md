# Push Notification Testing Instructions

## Prerequisites
- PWA app must be installed to home screen (especially for iOS 16.4+)
- Modern browser with push notification support
- Active internet connection

## iOS Testing (16.4+)

### Step 1: Add to Home Screen
1. Open the app in Safari on your iPhone/iPad
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. The app icon will appear on your home screen

### Step 2: Open PWA from Home Screen
1. **Important:** Open the app from the home screen icon, NOT from Safari
2. The app should open in standalone mode (no browser UI)
3. Only standalone PWA mode supports push notifications on iOS

### Step 3: Enable Notifications
1. In the app dashboard, scroll to the "Push Notifications" section
2. Tap "Request Permission"
3. When prompted, tap "Allow" for notifications
4. Tap "Enable Notifications" to subscribe
5. Test with "Send Test Notification"

### iOS Limitations & Quirks
- **Must be standalone PWA:** Notifications only work when opened from home screen
- **Safari limitations:** Won't work in regular Safari browser
- **iOS 16.4+ only:** Earlier iOS versions don't support PWA push notifications
- **Requires user gesture:** Permission must be requested in response to user action

## Android Testing

### Step 1: Install PWA (Optional but Recommended)
1. Open app in Chrome
2. Tap the menu (3 dots)
3. Select "Add to Home screen" or "Install app"
4. Confirm installation

### Step 2: Enable Notifications
1. In the app dashboard, find "Push Notifications" section
2. Click "Request Permission"
3. Allow notifications when prompted
4. Click "Enable Notifications"
5. Test with "Send Test Notification"

### Android Features
- Works in both browser and installed PWA
- More reliable than iOS
- Supports rich notifications with actions

## Desktop Testing

### Chrome/Edge/Firefox
1. Visit the app in your browser
2. Find "Push Notifications" section in dashboard
3. Click "Request Permission"
4. Allow notifications in browser prompt
5. Click "Enable Notifications"
6. Test with "Send Test Notification"

## Testing Features

### Available Test Actions
1. **Request Permission:** Asks browser for notification permission
2. **Enable Notifications:** Subscribes device to push notifications
3. **Send Test Notification:** Triggers a test notification immediately
4. **Disable Notifications:** Unsubscribes from notifications

### Test Notification Content
- Title: "Mok Sports Test Notification"
- Body: "Hey [FirstName], your push notifications are working! 🏈"
- Icon: App icon
- Actions: "Open App" and "Dismiss"

## Troubleshooting

### iOS Issues
- **"Not supported" message:** Make sure you're using iOS 16.4+ and opened from home screen
- **Permission denied:** Go to Settings > [App Name] > Notifications and enable
- **No notification received:** Check Do Not Disturb settings

### Android Issues
- **Permission denied:** Check browser notification settings for the site
- **No notification:** Ensure browser allows notifications and site isn't blocked

### General Issues
- **Subscription fails:** Check internet connection and try again
- **Test notification fails:** Verify subscription is active and permission granted
- **Service worker issues:** Try clearing browser cache and reinstalling PWA

## Real Use Cases

### When Notifications Are Sent
- League draft starts
- New member joins your league
- Trade proposals received
- Important league announcements
- Draft reminders

### Production Testing
1. Create a test league with friends
2. Have them install the PWA and enable notifications
3. Start a draft to test real notifications
4. Verify all members receive notifications

## Browser Support

### Supported
- Chrome 50+ (Android, Desktop)
- Firefox 44+ (Android, Desktop)
- Edge 17+ (Desktop)
- Safari 16.4+ (iOS, macOS) - PWA only

### Not Supported
- iOS Safari (browser mode)
- Internet Explorer
- Older browser versions
- Some privacy-focused browsers with strict settings