import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../models/models.dart';


class OpportunityDetailScreen extends StatefulWidget {
  final String opportunityId;

  const OpportunityDetailScreen({super.key, required this.opportunityId});

  @override
  State<OpportunityDetailScreen> createState() =>
      _OpportunityDetailScreenState();
}

class _OpportunityDetailScreenState extends State<OpportunityDetailScreen> {
  final _api = ApiClient(
    baseUrl: 'http://localhost:3000',
    apiKey: 'wm-scheduler-secret-key-123',
  );

  Opportunity? _opp;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final res = await _api.getOpportunityDetail(widget.opportunityId);
      setState(() {
        _opp = Opportunity.fromJson(res['data']);
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Color _getStatusColor(String status) {
    if (status == 'available') return const Color(0xFF00D68F);
    if (status == 'pending') return const Color(0xFFFFAA00);
    return Colors.grey;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Error')),
        body: Center(child: Text('Failed to load: $_error')),
      );
    }

    final opp = _opp!;

    return Scaffold(
      appBar: AppBar(
        title: Text(opp.resortName ?? 'Detail'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Header Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _getStatusColor(opp.status).withAlpha(30),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: _getStatusColor(opp.status).withAlpha(50)),
                      ),
                      child: Text(
                        opp.status.toUpperCase(),
                        style: TextStyle(
                          color: _getStatusColor(opp.status),
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    Text(
                      '\$${opp.estimatedProfit.toStringAsFixed(0)} Profit',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF00D68F),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  opp.eventName ?? 'Unknown Event',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.calendar_today,
                        size: 16, color: Colors.grey),
                    const SizedBox(width: 8),
                    Text(
                      opp.eventDate ?? 'Date unknown',
                      style: TextStyle(color: Colors.grey[400]),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined,
                        size: 16, color: Colors.grey),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '${opp.resortCity ?? ''}, ${opp.resortState ?? ''} (${opp.distanceMiles.toStringAsFixed(1)} miles away)',
                        style: TextStyle(color: Colors.grey[400]),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const Text('Financial Breakdown',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _detailRow('Est. Resale Value',
              '\$${opp.estimatedNightlyRate.toStringAsFixed(0)}/night'),
          _detailRow('Credit Cost',
              '${opp.estimatedCreditCost.toStringAsFixed(0)} credits'),
          _detailRow('Profit Score', opp.profitScore.toStringAsFixed(1)),

          const SizedBox(height: 24),
          const Text('Availability',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          // Placeholder for availability list (could map this if backend returned list)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Colors.blue),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Availability checks happen automatically every 6 hours. Check notification history for alerts.',
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[400])),
          Text(value,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
