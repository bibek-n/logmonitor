import "package:flutter/material.dart";
import "../services/api_client.dart";

class EndpointAgentsScreen extends StatefulWidget {
  final ApiClient apiClient;
  const EndpointAgentsScreen({super.key, required this.apiClient});

  @override
  State<EndpointAgentsScreen> createState() => _EndpointAgentsScreenState();
}

class _EndpointAgentsScreenState extends State<EndpointAgentsScreen> {
  List<DeviceItem> _devices = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final devices = await widget.apiClient.fetchDevices();
      setState(() {
        _devices = devices;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("ApiException: ", ""));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Endpoint Agents")),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _devices.isEmpty
                    ? const Center(child: Text("No devices enrolled."))
                    : ListView.builder(
                        itemCount: _devices.length,
                        itemBuilder: (context, i) {
                          final d = _devices[i];
                          return ListTile(
                            leading: const Icon(Icons.computer_outlined),
                            title: Text(d.hostname),
                            subtitle: Text(
                              [
                                if (d.staffName != null) d.staffName!,
                                if (d.lastIp != null) d.lastIp!,
                                if (d.macAddress != null) d.macAddress!,
                              ].join(" · "),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
