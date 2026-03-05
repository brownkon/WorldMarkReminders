import 'package:flutter/material.dart';
import '../services/api_client.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _api = ApiClient(
    baseUrl: 'http://localhost:3000',
    apiKey: 'wm-scheduler-secret-key-123',
  );

  Map<String, dynamic>? _settings;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final res = await _api.getSettings();
      setState(() {
        _settings = res['data'];
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendTestNotification() async {
    try {
      await _api.sendTestNotification('Hello from Flutter Companion App!');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Test notification sent')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _triggerPipeline() async {
    try {
      await _api.triggerFullPipeline();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Pipeline triggered')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _sectionHeader('Notifications'),
                _settingItem(
                    'Daily Limit', '${_settings?['notificationDailyLimit']}'),
                _settingItem('Ntfy Enabled', '${_settings?['ntfyEnabled']}'),
                _settingItem('APNs Configured', '${_settings?['apnsConfigured']}'),
                _settingItem('Devices', '${_settings?['registeredDevices']}'),

                const SizedBox(height: 24),
                _sectionHeader('Actions'),
                ListTile(
                  leading: const Icon(Icons.notifications_active),
                  title: const Text('Send Test Notification'),
                  onTap: _sendTestNotification,
                ),
                ListTile(
                  leading: const Icon(Icons.refresh),
                  title: const Text('Trigger Pipeline w/ Availability'),
                  onTap: _triggerPipeline,
                ),
              ],
            ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.bold,
          fontSize: 13,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _settingItem(String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontSize: 16)),
          Text(value, style: TextStyle(color: Colors.grey[400], fontSize: 16)),
        ],
      ),
    );
  }
}
