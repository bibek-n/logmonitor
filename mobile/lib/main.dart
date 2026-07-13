import "package:flutter/material.dart";
import "services/api_client.dart";
import "screens/login_screen.dart";
import "screens/home_screen.dart";

void main() {
  runApp(const LogMonitorApp());
}

class LogMonitorApp extends StatelessWidget {
  const LogMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "LogMonitor",
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: Colors.blueAccent, useMaterial3: true),
      home: const _SplashGate(),
    );
  }
}

/// Checks for a saved token before deciding whether to show the login screen or jump
/// straight to the home screen - the token itself is only validated lazily by the first
/// real API call each screen makes, not here (no dedicated "am I still logged in" endpoint).
class _SplashGate extends StatefulWidget {
  const _SplashGate();

  @override
  State<_SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<_SplashGate> {
  final _apiClient = ApiClient();
  bool? _loggedIn;

  @override
  void initState() {
    super.initState();
    _apiClient.isLoggedIn.then((v) => setState(() => _loggedIn = v));
  }

  @override
  Widget build(BuildContext context) {
    if (_loggedIn == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return _loggedIn! ? HomeScreen(apiClient: _apiClient) : LoginScreen(apiClient: _apiClient);
  }
}
