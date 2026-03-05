# WorldMark Companion App

This is the Flutter companion app for the WorldMark Scheduler backend.

## Getting Started

1.  **Start the Backend**:
    Make sure the Node.js backend is running on `http://localhost:3000`.
    ```bash
    cd ../
    npm run dev
    ```

2.  **Install Dependencies**:
    ```bash
    flutter pub get
    ```

3.  **Run the App**:
    - **iOS Simulator**: `flutter run -d iPhone`
    - **Android Emulator**: You may need to change the API URL in `lib/screens/*.dart` from `localhost` to `10.0.2.2`.

## Project Structure

- `lib/main.dart`: App entry point and theme configuration.
- `lib/models/models.dart`: JSON serialization models (`Opportunity`, `AppNotification`, etc.).
- `lib/services/api_client.dart`: HTTP client for backend communication.
- `lib/screens/`: UI screens for Dashboard, Opportunities, Notifications, Settings.
- `lib/widgets/`: Reusable UI components (`StatCard`, `OpportunityTile`).

## Configuration

The API Base URL and Key are currently hardcoded in each screen's state for simplicity.
To change them, look for `ApiClient` instantiation in `lib/screens/*.dart`.
