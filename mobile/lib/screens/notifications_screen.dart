import "package:flutter/material.dart";
import "../services/api_client.dart";

class NotificationsScreen extends StatefulWidget {
  final ApiClient apiClient;
  const NotificationsScreen({super.key, required this.apiClient});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _history = [];
  List<StaffOption> _staff = [];
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
      final results = await Future.wait([widget.apiClient.fetchNotifications(), widget.apiClient.fetchStaff()]);
      setState(() {
        _history = results[0] as List<NotificationItem>;
        _staff = results[1] as List<StaffOption>;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("ApiException: ", ""));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _openSendDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => _SendNotificationDialog(apiClient: widget.apiClient, staff: _staff),
    );
    if (result == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Notifications")),
      floatingActionButton: FloatingActionButton(onPressed: _openSendDialog, child: const Icon(Icons.add)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _history.isEmpty
                    ? const Center(child: Text("No notifications sent yet."))
                    : ListView.builder(
                        itemCount: _history.length,
                        itemBuilder: (context, i) {
                          final n = _history[i];
                          return ListTile(
                            leading: Icon(n.staffId == null ? Icons.campaign_outlined : Icons.person_outline),
                            title: Text(n.message),
                            subtitle: Text("${n.staffName ?? "Everyone"} · by ${n.sentByUsername} · ${n.createdAt}"),
                          );
                        },
                      ),
      ),
    );
  }
}

class _SendNotificationDialog extends StatefulWidget {
  final ApiClient apiClient;
  final List<StaffOption> staff;
  const _SendNotificationDialog({required this.apiClient, required this.staff});

  @override
  State<_SendNotificationDialog> createState() => _SendNotificationDialogState();
}

class _SendNotificationDialogState extends State<_SendNotificationDialog> {
  final _messageController = TextEditingController();
  int? _selectedStaffId;
  bool _sending = false;
  String? _error;

  Future<void> _send() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) {
      setState(() => _error = "Message is required.");
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.apiClient.sendNotification(staffId: _selectedStaffId, message: message);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("ApiException: ", ""));
    } finally {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text("Send Notification"),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButtonFormField<int?>(
            value: _selectedStaffId,
            decoration: const InputDecoration(labelText: "Send to"),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text("Everyone")),
              ...widget.staff.map((s) => DropdownMenuItem<int?>(value: s.id, child: Text(s.name))),
            ],
            onChanged: (v) => setState(() => _selectedStaffId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _messageController,
            decoration: const InputDecoration(labelText: "Message", border: OutlineInputBorder()),
            maxLength: 500,
            maxLines: 3,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
        ],
      ),
      actions: [
        TextButton(onPressed: _sending ? null : () => Navigator.of(context).pop(false), child: const Text("Cancel")),
        ElevatedButton(
          onPressed: _sending ? null : _send,
          child: _sending ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Send"),
        ),
      ],
    );
  }
}
