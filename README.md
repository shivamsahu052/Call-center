# Call Center Dialer

Expo SDK 57 mobile frontend with a separate Node backend.

## Start Both

Terminal 1:

```sh
npm run backend
```

Terminal 2:

```sh
cp .env.example .env
npm start
```

For Expo Go on a physical phone, set `EXPO_PUBLIC_API_URL` in `.env` to the
computer's LAN address, for example `http://192.168.1.20:4000`, then reload the
app. The backend binds to `0.0.0.0` so devices on the same network can reach it.

Set `EXPO_PUBLIC_CALL_MODE=system` to open the device phone app after the
backend accepts an outgoing call. The default `demo` mode keeps the call in the
app and exercises the complete server-backed lifecycle.
