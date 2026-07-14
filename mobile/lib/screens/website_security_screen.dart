import "package:flutter/material.dart";
import "../services/api_client.dart";

class WebsiteSecurityScreen extends StatefulWidget {
  final ApiClient apiClient;
  const WebsiteSecurityScreen({super.key, required this.apiClient});

  @override
  State<WebsiteSecurityScreen> createState() => _WebsiteSecurityScreenState();
}

class _WebsiteSecurityScreenState extends State<WebsiteSecurityScreen> {
  List<WebsiteSummary> _websites = [];
  bool _loading = true;
  String? _error;
  final Set<int> _scanning = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final websites = await widget.apiClient.fetchWebsites();
      setState(() {
        _websites = websites;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("ApiException: ", ""));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _scan(WebsiteSummary w) async {
    setState(() => _scanning.add(w.id));
    try {
      await widget.apiClient.scanWebsite(w.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Scan started for ${w.name} - this can take a minute.")));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst("ApiException: ", ""))));
    } finally {
      if (mounted) setState(() => _scanning.remove(w.id));
    }
  }

  Color _riskColor(String? risk) {
    switch (risk) {
      case "Critical":
        return Colors.red;
      case "High":
        return Colors.deepOrange;
      case "Medium":
        return Colors.amber.shade800;
      case "Low":
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Website Security")),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _websites.isEmpty
                    ? const Center(child: Text("No websites configured."))
                    : ListView.builder(
                        itemCount: _websites.length,
                        itemBuilder: (context, i) {
                          final w = _websites[i];
                          final isScanning = _scanning.contains(w.id);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            child: ListTile(
                              title: Text(w.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(w.url, style: const TextStyle(fontSize: 12)),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      if (w.latestScore != null) ...[
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: _riskColor(w.latestRisk).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            "${w.latestScore} · ${w.latestRisk ?? "Unknown"}",
                                            style: TextStyle(color: _riskColor(w.latestRisk), fontSize: 12, fontWeight: FontWeight.w600),
                                          ),
                                        ),
                                      ] else
                                        const Text("Not scanned yet", style: TextStyle(fontSize: 12, color: Colors.grey)),
                                    ],
                                  ),
                                ],
                              ),
                              trailing: isScanning
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                  : IconButton(icon: const Icon(Icons.play_circle_outline), onPressed: () => _scan(w), tooltip: "Scan now"),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
