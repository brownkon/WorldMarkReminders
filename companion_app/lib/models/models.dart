class Opportunity {
  final String id;
  final String resortId;
  final String eventId;
  final double distanceMiles;
  final double profitScore;
  final double estimatedNightlyRate;
  final double estimatedCreditCost;
  final double estimatedProfit;
  final int rank;
  final String status;
  final String? resortName;
  final String? resortCity;
  final String? resortState;
  final String? eventName;
  final String? eventDate;
  final String? eventCategory;
  final String? eventVenue;

  Opportunity({
    required this.id,
    required this.resortId,
    required this.eventId,
    required this.distanceMiles,
    required this.profitScore,
    required this.estimatedNightlyRate,
    required this.estimatedCreditCost,
    required this.estimatedProfit,
    required this.rank,
    required this.status,
    this.resortName,
    this.resortCity,
    this.resortState,
    this.eventName,
    this.eventDate,
    this.eventCategory,
    this.eventVenue,
  });

  factory Opportunity.fromJson(Map<String, dynamic> json) {
    return Opportunity(
      id: json['id'] as String,
      resortId: json['resort_id'] as String,
      eventId: json['event_id'] as String,
      distanceMiles: (json['distance_miles'] as num).toDouble(),
      profitScore: (json['profit_score'] as num? ?? 0).toDouble(),
      estimatedNightlyRate:
          (json['estimated_nightly_rate'] as num? ?? 0).toDouble(),
      estimatedCreditCost:
          (json['estimated_credit_cost'] as num? ?? 0).toDouble(),
      estimatedProfit: (json['estimated_profit'] as num? ?? 0).toDouble(),
      rank: json['rank'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      resortName: json['resort_name'] as String?,
      resortCity: json['resort_city'] as String?,
      resortState: json['resort_state'] as String?,
      eventName: json['event_name'] as String?,
      eventDate: json['event_date'] as String?,
      eventCategory: json['event_category'] as String?,
      eventVenue: json['event_venue'] as String?,
    );
  }
}

class AppNotification {
  final String id;
  final String opportunityId;
  final String type;
  final String recipient;
  final String body;
  final String sentAt;
  final String status;
  final String? errorMessage;
  final bool isRead;

  AppNotification({
    required this.id,
    required this.opportunityId,
    required this.type,
    required this.recipient,
    required this.body,
    required this.sentAt,
    required this.status,
    this.errorMessage,
    required this.isRead,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      opportunityId: json['opportunity_id'] as String,
      type: json['type'] as String,
      recipient: json['recipient'] as String,
      body: json['body'] as String,
      sentAt: json['sent_at'] as String,
      status: json['status'] as String,
      errorMessage: json['error_message'] as String?,
      isRead: (json['is_read'] as int? ?? 0) == 1,
    );
  }
}

class Resort {
  final String id;
  final String name;
  final String brand;
  final String? city;
  final String? state;
  final double latitude;
  final double longitude;
  final String? portalUrl;

  Resort({
    required this.id,
    required this.name,
    required this.brand,
    this.city,
    this.state,
    required this.latitude,
    required this.longitude,
    this.portalUrl,
  });

  factory Resort.fromJson(Map<String, dynamic> json) {
    return Resort(
      id: json['id'] as String,
      name: json['name'] as String,
      brand: json['brand'] as String,
      city: json['city'] as String?,
      state: json['state'] as String?,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      portalUrl: json['portal_url'] as String?,
    );
  }
}

class Event {
  final String id;
  final String name;
  final String? category;
  final String? venueName;
  final String? venueCity;
  final String? venueState;
  final String startDate;
  final String? url;
  final String? imageUrl;

  Event({
    required this.id,
    required this.name,
    this.category,
    this.venueName,
    this.venueCity,
    this.venueState,
    required this.startDate,
    this.url,
    this.imageUrl,
  });

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      venueName: json['venue_name'] as String?,
      venueCity: json['venue_city'] as String?,
      venueState: json['venue_state'] as String?,
      startDate: json['start_date'] as String,
      url: json['url'] as String?,
      imageUrl: json['image_url'] as String?,
    );
  }
}

class DashboardData {
  final List<Opportunity> topOpportunities;
  final List<AppNotification> recentAlerts;
  final int unreadNotificationCount;
  final int totalResorts;
  final int totalEvents;
  final int totalOpportunities;

  DashboardData({
    required this.topOpportunities,
    required this.recentAlerts,
    required this.unreadNotificationCount,
    required this.totalResorts,
    required this.totalEvents,
    required this.totalOpportunities,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    // Defensive parsing: handle nulls gracefully
    final data = (json['data'] as Map<String, dynamic>?) ?? {};
    final stats = (data['stats'] as Map<String, dynamic>?) ?? {};

    return DashboardData(
      topOpportunities: ((data['topOpportunities'] as List?) ?? [])
          .map((e) => Opportunity.fromJson(e as Map<String, dynamic>))
          .toList(),
      recentAlerts: ((data['recentAlerts'] as List?) ?? [])
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList(),
      unreadNotificationCount: data['unreadNotificationCount'] as int? ?? 0,
      totalResorts: stats['totalResorts'] as int? ?? 0,
      totalEvents: stats['totalEvents'] as int? ?? 0,
      totalOpportunities: stats['totalOpportunities'] as int? ?? 0,
    );
  }
}
