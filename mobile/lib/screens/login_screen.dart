import "package:flutter/material.dart";
import "../services/api_client.dart";
import "home_screen.dart";

class LoginScreen extends StatefulWidget {
  final ApiClient apiClient;
  const LoginScreen({super.key, required this.apiClient});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();

  bool _otpStage = false;
  bool _loading = false;
  String? _error;

  Future<void> _requestOtp() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.apiClient.requestOtp(_usernameController.text.trim(), _passwordController.text);
      setState(() => _otpStage = true);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("ApiException: ", ""));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.apiClient.verifyOtp(_usernameController.text.trim(), _passwordController.text, _otpController.text.trim());
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => HomeScreen(apiClient: widget.apiClient)));
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("ApiException: ", ""));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.shield_outlined, size: 56, color: Colors.blueAccent),
                const SizedBox(height: 12),
                const Text("LogMonitor", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                const SizedBox(height: 4),
                Text(
                  _otpStage ? "Enter the code emailed to you" : "Sign in to your admin account",
                  style: const TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                if (!_otpStage) ...[
                  TextField(
                    controller: _usernameController,
                    decoration: const InputDecoration(labelText: "Username", border: OutlineInputBorder()),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    decoration: const InputDecoration(labelText: "Password", border: OutlineInputBorder()),
                    obscureText: true,
                    onSubmitted: (_) => _requestOtp(),
                  ),
                ] else
                  TextField(
                    controller: _otpController,
                    decoration: const InputDecoration(labelText: "6-digit code", border: OutlineInputBorder()),
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    onSubmitted: (_) => _verifyOtp(),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loading ? null : (_otpStage ? _verifyOtp : _requestOtp),
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: _loading
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(_otpStage ? "Verify" : "Continue"),
                ),
                if (_otpStage)
                  TextButton(
                    onPressed: _loading ? null : () => setState(() => _otpStage = false),
                    child: const Text("Back"),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
