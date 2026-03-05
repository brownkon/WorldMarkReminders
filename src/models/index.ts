// ============================================
// WorldMark Scheduler — Data Models
// ============================================

export interface Resort {
    id: string;
    name: string;
    brand: 'worldmark' | 'club_wyndham';
    address: string;
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    url: string;
    unitTypes: string; // JSON array of unit type names
    createdAt: string;
    updatedAt: string;
}

export interface CreditChart {
    id: string;
    resortId: string;
    unitType: string; // e.g., "Studio", "1BR", "2BR Deluxe"
    season: 'red' | 'white' | 'blue';
    dayType: 'weekday' | 'weekend' | 'sunday'; // Mon-Thu, Fri-Sat, Sun
    creditsPerNight: number;
    effectiveDate: string;
    createdAt: string;
}

export interface Event {
    id: string;
    externalId: string;
    source: 'ticketmaster';
    name: string;
    description: string;
    category: string;
    subcategory: string;
    venueName: string;
    venueCity: string;
    venueState: string;
    venueLatitude: number;
    venueLongitude: number;
    startDate: string;
    endDate: string | null;
    estimatedAttendance: number | null;
    url: string;
    imageUrl: string;
    createdAt: string;
    updatedAt: string;
}

export interface Opportunity {
    id: string;
    resortId: string;
    eventId: string;
    distanceMiles: number;
    profitScore: number;
    estimatedNightlyRate: number; // Estimated hotel market rate
    estimatedCreditCost: number; // Credits needed
    estimatedProfit: number; // Market rate - credit cost in dollars
    rank: number;
    status: 'pending' | 'available' | 'unavailable' | 'booked' | 'expired';
    createdAt: string;
    updatedAt: string;
}

export interface Availability {
    id: string;
    opportunityId: string;
    resortId: string;
    checkInDate: string;
    checkOutDate: string;
    unitType: string;
    creditsRequired: number;
    isAvailable: boolean;
    checkedAt: string;
}

export interface Notification {
    id: string;
    opportunityId: string;
    type: 'sms' | 'push';
    recipient: string;
    subject: string;
    body: string;
    sentAt: string;
    status: 'sent' | 'failed' | 'pending';
    errorMessage: string | null;
}

export interface PipelineRun {
    id: string;
    stage: 'resort_refresh' | 'event_discovery' | 'ranking' | 'availability_check' | 'notification';
    status: 'running' | 'completed' | 'failed';
    startedAt: string;
    completedAt: string | null;
    itemsProcessed: number;
    errorMessage: string | null;
}

// ============================================
// API Response Types
// ============================================

export interface OpportunityWithDetails extends Opportunity {
    resort: Resort;
    event: Event;
    availability: Availability[];
}

export interface DashboardData {
    topOpportunities: OpportunityWithDetails[];
    recentAlerts: Notification[];
    upcomingEvents: Event[];
    lastPipelineRun: PipelineRun | null;
    stats: {
        totalResorts: number;
        totalEvents: number;
        totalOpportunities: number;
        availableOpportunities: number;
    };
}
