import "package:flutter/material.dart";
import "../services/api_client.dart";
import "login_screen.dart";
import "notifications_screen.dart";
import "website_security_screen.dart";
import "endpoint_agents_screen.dart";
import "cameras_screen.dart";

/// Landing screen after login - every tile is wired up to a real screen.
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
          _Tile(
            icon: Icons.videocam_outlined,
            label: "Cameras",
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CamerasScreen(apiClient: apiClient))),
          ),
          _Tile(
            icon: Icons.security_outlined,
            label: "Website Security",
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => WebsiteSecurityScreen(apiClient: apiClient))),
          ),
          _Tile(
            icon: Icons.devices_outlined,
            label: "Endpoint Agents",
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => EndpointAgentsScreen(apiClient: apiClient))),
          ),
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
