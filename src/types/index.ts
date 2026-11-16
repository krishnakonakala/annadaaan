export type UserRole =
  | 'ROLE_ADMIN'
  | 'ROLE_RESTAURANT'
  | 'ROLE_NGO'
  | 'ROLE_INDIVIDUAL'
  | 'ROLE_VOLUNTEER';

export type DonationStatus =
  | 'DRAFT'
  | 'AVAILABLE'
  | 'REQUESTED'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type FoodCategory =
  | 'COOKED_MEALS'
  | 'RICE_AND_BIRYANI'
  | 'VEGETABLES'
  | 'FRUITS'
  | 'BAKERY'
  | 'PACKAGED'
  | 'SNACKS'
  | 'OTHER';

export type OrganizationType =
  | 'ORPHANAGE'
  | 'OLD_AGE_HOME'
  | 'HOMELESS_SHELTER'
  | 'CHARITABLE_TRUST'
  | 'COMMUNITY_KITCHEN'
  | 'FOOD_BANK'
  | 'OTHER_NGO';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type DonationOccasion =
  | 'WEDDING'
  | 'BIRTHDAY'
  | 'FESTIVAL'
  | 'FAMILY_FUNCTION'
  | 'CORPORATE_EVENT'
  | 'COMMUNITY_GATHERING'
  | 'EVERYDAY_SURPLUS'
  | 'OTHER';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  location: LocationCoordinates;
  createdAt: string;

  // Organization & role-specific metadata
  organizationName?: string;
  organizationType?: OrganizationType;
  registrationNumber?: string;
  issuingAuthority?: string;
  contactPerson?: string;
  documentRef?: string;
  operatingHours?: string;
  maxReceivingCapacityKg?: number;
  currentAvailableCapacityKg?: number;
  beneficiariesCount?: number;
  foodPreferences?: ('VEG' | 'NON_VEG' | 'ALL')[];
  licenseNumber?: string;
  restaurantCategory?: string;
  vehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER' | 'VAN' | 'ELECTRIC_BIKE';
  maxTravelDistanceKm?: number;
  availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
}

export interface StatusHistoryItem {
  status: DonationStatus;
  timestamp: string;
  performedByRole: UserRole;
  performedByName: string;
  note?: string;
}

export interface DonationItem {
  id: string;
  donorId: string;
  donorName: string;
  donorType: 'RESTAURANT' | 'INDIVIDUAL';
  title: string;
  description: string;
  category: FoodCategory;
  isVegetarian: boolean;
  quantityKg: number;
  estimatedServings: number;
  preparationTimestamp: string;
  expiryTimestamp: string;
  safeConsumptionDeadline: string;
  storageConditions: string;
  allergenInfo?: string;
  foodHandlingDeclared: boolean;
  occasion?: DonationOccasion;
  pickupLocation: LocationCoordinates;
  pickupTimeWindow: string;
  specialInstructions?: string;
  status: DonationStatus;
  allocatedNgoId?: string;
  allocatedNgoName?: string;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  pickupQrCode: string;
  deliveryQrCode: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryItem[];
}

export interface DonationRequestItem {
  id: string;
  donationId: string;
  donationTitle: string;
  ngoId: string;
  ngoName: string;
  requestedQuantityKg: number;
  beneficiariesCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestTimestamp: string;
  responseTimestamp?: string;
  rejectionReason?: string;
}

export interface VolunteerAssignment {
  id: string;
  donationId: string;
  donationTitle: string;
  volunteerId: string;
  volunteerName: string;
  donorName: string;
  pickupAddress: string;
  pickupCoordinates: [number, number];
  ngoName: string;
  deliveryAddress: string;
  deliveryCoordinates: [number, number];
  status: 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED';
  pickupDeadline: string;
  assignedAt: string;
  pickedUpAt?: string;
  completedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  targetRole: UserRole | 'ALL';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'INFO' | 'MATCH' | 'REQUEST' | 'PICKUP' | 'DELIVERY' | 'ALERT';
}

export interface AuditLogItem {
  id: string;
  actorUserId: string;
  actorRole: UserRole;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface ComplaintItem {
  id: string;
  reporterUserId: string;
  reporterName: string;
  donationId?: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchingResult {
  ngo: UserProfile;
  distanceKm: number;
  capacityScore: number;
  distanceScore: number;
  compatibilityScore: number;
  availabilityScore: number;
  urgencyScore: number;
  totalScore: number;
  matchGrade: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'MODERATE';
}

export interface AnalyticsSummary {
  totalFoodRescuedKg: number;
  totalMealsDistributed: number;
  activeDonationsCount: number;
  completedDonationsCount: number;
  expiredDonationsCount: number;
  participatingRestaurants: number;
  approvedNgos: number;
  pendingVerificationsCount: number;
  registeredVolunteers: number;
  co2EmissionsPreventedKg: number;
  categoryBreakdown: { category: string; kg: number; count: number }[];
  statusBreakdown: { status: string; count: number }[];
}
