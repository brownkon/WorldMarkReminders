import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../models/models.dart';
import '../widgets/cards.dart';
import '../services/config.dart';
import 'opportunity_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiClient(
    baseUrl: AppConfig.baseUrl,
    apiKey: AppConfig.apiKey,
  );

  DashboardData? _data;
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
      final res = await _api.getDashboard(limit: 5);
      setState(() {
        _data = DashboardData.fromJson(res);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _onOpportunityTap(Opportunity opp) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OpportunityDetailScreen(opportunityId: opp.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      // Stats Row
                      Row(
                        children: [
                          Expanded(
                            child: StatCard(
                              label: 'Active Deals',
                              value: '${_data!.totalOpportunities}',
                              icon: Icons.local_offer,
                              accentColor: const Color(0xFF00D68F),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: StatCard(
                              label: 'Unread Alerts',
                              value: '${_data!.unreadNotificationCount}',
                              icon: Icons.notifications_active,
                              accentColor: const Color(0xFFFF4757),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: StatCard(
                              label: 'Resorts',
                              value: '${_data!.totalResorts}',
                              icon: Icons.apartment,
                              accentColor: const Color(0xFF5352ED),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: StatCard(
                              label: 'Events',
                              value: '${_data!.totalEvents}',
                              icon: Icons.event,
                              accentColor: const Color(0xFFFFA502),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 32),
                      Text(
                        'Top Opportunities',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 16),
                      if (_data!.topOpportunities.isEmpty)
                        const Text('No opportunities found yet.',
                            style: TextStyle(color: Colors.grey)),
                      ..._data!.topOpportunities.map((opp) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: OpportunityTile(
                              resortName: opp.resortName ?? 'Unknown Resort',
                              eventName: opp.eventName ?? 'Unknown Event',
                              profit:
                                  '\$${opp.estimatedProfit.toStringAsFixed(0)}',
                              status: opp.status,
                              distance:
                                  '${opp.distanceMiles.toStringAsFixed(1)} mi',
                              onTap: () => _onOpportunityTap(opp),
                            ),
                          )),
                    ],
                  ),
                ),
    );
  }
}
