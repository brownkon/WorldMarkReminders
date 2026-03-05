import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../models/models.dart';
import '../widgets/cards.dart';
import 'opportunity_detail_screen.dart';

class OpportunitiesScreen extends StatefulWidget {
  const OpportunitiesScreen({super.key});

  @override
  State<OpportunitiesScreen> createState() => _OpportunitiesScreenState();
}

class _OpportunitiesScreenState extends State<OpportunitiesScreen> {
  final _api = ApiClient(
    baseUrl: 'http://localhost:3000',
    apiKey: 'wm-scheduler-secret-key-123',
  );

  List<Opportunity> _opportunities = [];
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
      final res = await _api.getOpportunities(limit: 50);
      final List<dynamic> data = res['data'];
      setState(() {
        _opportunities = data.map((e) => Opportunity.fromJson(e)).toList();
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
      appBar: AppBar(title: const Text('Deals')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _opportunities.length,
                    itemBuilder: (context, index) {
                      final opp = _opportunities[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: OpportunityTile(
                          resortName: opp.resortName ?? 'Unknown Resort',
                          eventName: opp.eventName ?? 'Unknown Event',
                          profit: '\$${opp.estimatedProfit.toStringAsFixed(0)}',
                          status: opp.status,
                          distance: '${opp.distanceMiles.toStringAsFixed(1)} mi',
                          onTap: () => _onOpportunityTap(opp),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
