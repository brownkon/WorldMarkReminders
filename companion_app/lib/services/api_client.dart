import 'dart:convert';
import 'package:http/http.dart' as http;

/// Typed wrapper around the WorldMark Scheduler backend API.
class ApiClient {
  final String baseUrl;
  final String apiKey;
  final http.Client _http;

  ApiClient({
    required this.baseUrl,
    required this.apiKey,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  // ──────────────────────────────
  // Helpers
  // ──────────────────────────────

  Map<String, String> get _headers => {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl/api$path').replace(queryParameters: query);

  Future<Map<String, dynamic>> _get(String path,
      [Map<String, String>? query]) async {
    final res = await _http.get(_uri(path, query), headers: _headers);
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, res.body);
    }
    return json.decode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _post(String path,
      [Map<String, dynamic>? body]) async {
    final res = await _http.post(
      _uri(path),
      headers: _headers,
      body: body != null ? json.encode(body) : null,
    );
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw ApiException(res.statusCode, res.body);
    }
    return json.decode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _patch(String path,
      [Map<String, dynamic>? body]) async {
    final res = await _http.patch(
      _uri(path),
      headers: _headers,
      body: body != null ? json.encode(body) : null,
    );
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, res.body);
    }
    return json.decode(res.body) as Map<String, dynamic>;
  }

  Future<void> _delete(String path) async {
    final res = await _http.delete(_uri(path), headers: _headers);
    if (res.statusCode != 200 && res.statusCode != 204) {
      throw ApiException(res.statusCode, res.body);
    }
  }

  // ──────────────────────────────
  // Dashboard
  // ──────────────────────────────

  Future<Map<String, dynamic>> getDashboard({
    double? minProfit,
    int? limit,
  }) async {
    final query = <String, String>{};
    if (minProfit != null) query['minProfit'] = minProfit.toString();
    if (limit != null) query['limit'] = limit.toString();
    return _get('/dashboard', query.isNotEmpty ? query : null);
  }

  // ──────────────────────────────
  // Opportunities
  // ──────────────────────────────

  Future<Map<String, dynamic>> getOpportunities({
    int? limit,
    double? minProfit,
  }) async {
    final query = <String, String>{};
    if (limit != null) query['limit'] = limit.toString();
    if (minProfit != null) query['minProfit'] = minProfit.toString();
    return _get('/opportunities', query.isNotEmpty ? query : null);
  }

  Future<Map<String, dynamic>> getOpportunityDetail(String id) =>
      _get('/opportunities/$id');

  // ──────────────────────────────
  // Notifications
  // ──────────────────────────────

  Future<Map<String, dynamic>> getNotifications({
    int? limit,
    bool? unreadOnly,
  }) async {
    final query = <String, String>{};
    if (limit != null) query['limit'] = limit.toString();
    if (unreadOnly == true) query['unreadOnly'] = 'true';
    return _get('/notifications', query.isNotEmpty ? query : null);
  }

  Future<Map<String, dynamic>> markNotificationRead(String id) =>
      _patch('/notifications/$id/read');

  Future<Map<String, dynamic>> markAllNotificationsRead() =>
      _patch('/notifications/read-all');

  // ──────────────────────────────
  // Resorts
  // ──────────────────────────────

  Future<Map<String, dynamic>> getResorts({String? brand}) async {
    final query = <String, String>{};
    if (brand != null) query['brand'] = brand;
    return _get('/resorts', query.isNotEmpty ? query : null);
  }

  Future<Map<String, dynamic>> getResortDetail(String id) =>
      _get('/resorts/$id');

  // ──────────────────────────────
  // Events
  // ──────────────────────────────

  Future<Map<String, dynamic>> getEvents({int? limit}) async {
    final query = <String, String>{};
    if (limit != null) query['limit'] = limit.toString();
    return _get('/events', query.isNotEmpty ? query : null);
  }

  // ──────────────────────────────
  // Availability
  // ──────────────────────────────

  Future<Map<String, dynamic>> getAvailability(String opportunityId) =>
      _get('/availability/$opportunityId');

  // ──────────────────────────────
  // Pipeline
  // ──────────────────────────────

  Future<Map<String, dynamic>> getPipelineStatus() => _get('/pipeline/status');
  Future<Map<String, dynamic>> triggerFullPipeline() =>
      _post('/pipeline/run');
  Future<Map<String, dynamic>> triggerResortRefresh() =>
      _post('/pipeline/resorts');
  Future<Map<String, dynamic>> triggerEventDiscovery() =>
      _post('/pipeline/events');

  // ──────────────────────────────
  // Device Registration (APNs)
  // ──────────────────────────────

  Future<Map<String, dynamic>> registerDevice(String token,
      {String platform = 'ios'}) {
    return _post('/devices', {'token': token, 'platform': platform});
  }

  Future<void> removeDevice(String token) => _delete('/devices/$token');

  // ──────────────────────────────
  // Settings
  // ──────────────────────────────

  Future<Map<String, dynamic>> getSettings() => _get('/settings');

  // ──────────────────────────────
  // Health
  // ──────────────────────────────

  Future<Map<String, dynamic>> healthCheck() => _get('/health');

  // ──────────────────────────────
  // Test Notification
  // ──────────────────────────────

  Future<Map<String, dynamic>> sendTestNotification([String? message]) {
    final body = <String, dynamic>{};
    if (message != null) body['message'] = message;
    return _post('/test-notification', body.isNotEmpty ? body : null);
  }

  void dispose() => _http.close();
}

class ApiException implements Exception {
  final int statusCode;
  final String body;

  ApiException(this.statusCode, this.body);

  @override
  String toString() => 'ApiException($statusCode): $body';
}
