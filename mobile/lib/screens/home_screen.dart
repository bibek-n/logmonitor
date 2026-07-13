import "package:flutter/material.dart";
import "../services/api_client.dart";
import "login_screen.dart";
import "notifications_screen.dart";

/// Landing screen after login. Deliberately just a launcher grid for now - cameras,
/// website security, and endpoint agents are follow-up phases (see the mobile app plan),
/// notifications is the first complete vertical slice.
class HomeScreen extends StatelessWidget {
  final ApiClient apiClient;
  const HomeScreen({super.key, required this.apiClient});

  Future<void> _logout(BuildContext context) async {
    await apiClient.logout();
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => LoginScreen(apiClient: apiClient)),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("LogMonitor"),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: () => _logout(context), tooltip: "Log out"),
        ],
      ),
      body: GridView.count(
        padding: const EdgeInsets.all(16),
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        children: [
          _Tile(
            icon: Icons.notifications_active_outlined,
            label: "Notifications",
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotificationsScreen(apiClient: apiClient))),
          ),
          const _Tile(icon: Icons.videocam_outlined, label: "Cameras", comingSoon: true),
          const _Tile(icon: Icons.security_outlined, label: "Website Security", comingSoon: true),
          const _Tile(icon: Icons.devices_outlined, label: "Endpoint Agents", comingSoon: true),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool comingSoon;
  const _Tile({required this.icon, required this.label, this.onTap, this.comingSoon = false});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: comingSoon
            ? () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Coming soon")))
            : onTap,
        child: Opacity(
          opacity: comingSoon ? 0.5 : 1,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 36),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
