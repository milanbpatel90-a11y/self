# Trainer Portal APK Wrapper

This folder contains a minimal Android WebView app that opens the deployed trainer portal:

`https://self-delta-three.vercel.app/quick-ticket`

## Build

1. Install Android Studio.
2. Open the `android-trainer-portal` folder as a project.
3. Let Gradle sync.
4. Build the APK:
   `Build -> Build Bundle(s) / APK(s) -> Build APK(s)`

## Output

The debug APK will be created under:

`app/build/outputs/apk/debug/`

## Notes

- This workspace does not currently have Java/Android SDK installed, so the APK was not compiled here.
- The app loads the live trainer portal URL, so the phone needs internet access.
