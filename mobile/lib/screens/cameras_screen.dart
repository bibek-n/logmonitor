import "package:flutter/material.dart";
import "../services/api_client.dart";
import "camera_live_view_screen.dart";

class CamerasScreen extends StatefulWidget {
  final ApiClient apiClient;
  const CamerasScreen({super.key, required this.apiClient});

  @override
  State<CamerasScreen> createState() => _CamerasScreenState();
}

class _CamerasScreenState extends State<CamerasScreen> {
  List<CameraItem> _cameras = [];
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
      final cameras = await widget.apiClient.fetchCameras();
      setState(() {
        _cameras = cameras;
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
      appBar: AppBar(title: const Text("Cameras")),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _cameras.isEmpty
                    ? const Center(child: Text("No cameras configured."))
                    : GridView.builder(
                        padding: const EdgeInsets.all(12),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.1,
                        ),
                        itemCount: _cameras.length,
                        itemBuilder: (context, i) {
                          final cam = _cameras[i];
                          return Card(
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => CameraLiveViewScreen(apiClient: widget.apiClient, camera: cam)),
                              ),
                              child: Column(
                                children: [
                                  Expanded(
                                    child: Container(
                                      color: Colors.black,
                                      alignment: Alignment.center,
                                      child: const Icon(Icons.videocam_outlined, color: Colors.white54, size: 32),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(8),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(cam.displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                                        if (cam.location != null)
                                          Text(cam.location!, style: const TextStyle(fontSize: 11, color: Colors.grey), maxLines: 1, overflow: TextOverflow.ellipsis),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
