import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../models/models.dart';
import '../widgets/cards.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiClient(
    baseUrl: 'http://localhost:3000',
    apiKey: 'wm-scheduler-secret-key-123',
  );

  List<AppNotification> _notifications = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await _api.getNotifications(limit: 50);
      final List<dynamic> data = res['data'];
      setState(() {
        _notifications = data.map((e) => AppNotification.fromJson(e)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _markAsRead(AppNotification notif) async {
    if (notif.isRead) return;

    try {
      await _api.markNotificationRead(notif.id);
      setState(() {
        final index = _notifications.indexWhere((n) => n.id == notif.id);
        if (index != -1) {
          _notifications[index] = AppNotification(
            id: notif.id,
            opportunityId: notif.opportunityId,
            type: notif.type,
            recipient: notif.recipient,
            body: notif.body,
            sentAt: notif.sentAt,
            status: notif.status,
            errorMessage: notif.errorMessage,
            isRead: true,
          );
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to mark read: $e')),
        );
      }
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _api.markAllNotificationsRead();
      _loadData(); // Reload to refresh UI
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to mark all read: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark all read',
            onPressed: _markAllRead,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _notifications.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final notif = _notifications[index];
                      return NotificationTile(
                        body: notif.body,
                        sentAt: notif.sentAt,
                        isRead: notif.isRead,
                        onTap: () => _markAsRead(notif),
                      );
                    },
                  ),
                ),
    );
  }
}
