import javafx.animation.FadeTransition;
import javafx.animation.ParallelTransition;
import javafx.animation.ScaleTransition;
import javafx.application.Application;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.chart.BarChart;
import javafx.scene.chart.CategoryAxis;
import javafx.scene.chart.NumberAxis;
import javafx.scene.chart.XYChart;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.stage.Modality;
import javafx.stage.Stage;
import javafx.util.Duration;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * ANNADAAN — Complete Single-File Java 21 + JavaFX + JDBC + MySQL Application.
 * Compile & run with JavaFX 21 SDK and mysql-connector-j on the module/classpath:
 *   Configure JDBC URL via ANNADAAN_DB_URL, ANNADAAN_DB_USER, ANNADAAN_DB_PASS.
 */
public class AnnadaanApplication extends Application {

    // =========================================================================
    // 1. DOMAIN ENUMS & MODELS
    // =========================================================================

    public enum UserRole {
        ROLE_RESTAURANT,
        ROLE_NGO,
        ROLE_INDIVIDUAL,
        ROLE_VOLUNTEER,
        ROLE_ADMIN
    }

    public enum VerificationStatus {
        PENDING,
        APPROVED,
        REJECTED,
        SUSPENDED
    }

    public enum DonationStatus {
        DRAFT,
        AVAILABLE,
        REQUESTED,
        APPROVED,
        ASSIGNED,
        PICKED_UP,
        DELIVERED,
        COMPLETED,
        REJECTED,
        CANCELLED,
        EXPIRED
    }

    public record UserAccount(
            String id,
            String fullName,
            String email,
            String phone,
            UserRole role,
            VerificationStatus verificationStatus,
            String rejectionReason,
            String organizationName,
            String referenceNumber,
            String city,
            String address,
            double latitude,
            double longitude,
            double availableCapacityKg,
            int beneficiariesCount
    ) {}

    public record DonationRecord(
            String id,
            String donorId,
            String donorName,
            String title,
            String category,
            boolean vegetarian,
            double quantityKg,
            int estimatedServings,
            Instant safeDeadline,
            Instant expiryTimestamp,
            DonationStatus status,
            String allocatedNgoId,
            String allocatedNgoName,
            String assignedVolunteerId,
            String assignedVolunteerName,
            String pickupQrCode,
            String deliveryQrCode,
            String pickupCity,
            String pickupAddress,
            double pickupLat,
            double pickupLng
    ) {}

    public record FoodRequestRecord(
            String id,
            String donationId,
            String donationTitle,
            String ngoId,
            String ngoName,
            double requestedQuantityKg,
            String status,
            String requestTimestamp
    ) {}

    public record NgoMatch(UserAccount ngo, double distanceKm, int score) {}

    // =========================================================================
    // 2. PASSWORD HASHING (PBKDF2WithHmacSHA256)
    // =========================================================================

    public static final class PasswordHasher {
        private static final int ITERATIONS = 120_000;
        private static final int KEY_LENGTH = 256;
        private static final SecureRandom RNG = new SecureRandom();

        public static String hash(String plainPassword) {
            byte[] salt = new byte[16];
            RNG.nextBytes(salt);
            byte[] derived = pbkdf2(plainPassword.toCharArray(), salt);
            return Base64.getEncoder().encodeToString(salt) + ":" +
                   Base64.getEncoder().encodeToString(derived);
        }

        public static boolean verify(String plainPassword, String storedHash) {
            String[] parts = storedHash.split(":");
            if (parts.length != 2) return false;
            byte[] salt = Base64.getDecoder().decode(parts[0]);
            byte[] expected = Base64.getDecoder().decode(parts[1]);
            byte[] actual = pbkdf2(plainPassword.toCharArray(), salt);
            return MessageDigest.isEqual(expected, actual);
        }

        private static byte[] pbkdf2(char[] password, byte[] salt) {
            try {
                PBEKeySpec spec = new PBEKeySpec(password, salt, ITERATIONS, KEY_LENGTH);
                SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
                return skf.generateSecret(spec).getEncoded();
            } catch (Exception e) {
                throw new IllegalStateException("Password hashing failed", e);
            }
        }
    }

    // =========================================================================
    // 3. DONATION STATE MACHINE & MATCHING ENGINE
    // =========================================================================

    public static final class DonationStateMachine {
        private static final Map<DonationStatus, Set<DonationStatus>> TRANSITIONS = Map.ofEntries(
                Map.entry(DonationStatus.DRAFT, EnumSet.of(DonationStatus.AVAILABLE, DonationStatus.CANCELLED, DonationStatus.EXPIRED)),
                Map.entry(DonationStatus.AVAILABLE, EnumSet.of(DonationStatus.REQUESTED, DonationStatus.CANCELLED, DonationStatus.EXPIRED)),
                Map.entry(DonationStatus.REQUESTED, EnumSet.of(DonationStatus.APPROVED, DonationStatus.REJECTED, DonationStatus.AVAILABLE, DonationStatus.CANCELLED, DonationStatus.EXPIRED)),
                Map.entry(DonationStatus.APPROVED, EnumSet.of(DonationStatus.ASSIGNED, DonationStatus.CANCELLED, DonationStatus.EXPIRED)),
                Map.entry(DonationStatus.ASSIGNED, EnumSet.of(DonationStatus.PICKED_UP, DonationStatus.CANCELLED)),
                Map.entry(DonationStatus.PICKED_UP, EnumSet.of(DonationStatus.DELIVERED)),
                Map.entry(DonationStatus.DELIVERED, EnumSet.of(DonationStatus.COMPLETED)),
                Map.entry(DonationStatus.COMPLETED, EnumSet.noneOf(DonationStatus.class)),
                Map.entry(DonationStatus.REJECTED, EnumSet.of(DonationStatus.AVAILABLE)),
                Map.entry(DonationStatus.CANCELLED, EnumSet.noneOf(DonationStatus.class)),
                Map.entry(DonationStatus.EXPIRED, EnumSet.noneOf(DonationStatus.class))
        );

        public static boolean canTransition(DonationStatus from, DonationStatus to) {
            return TRANSITIONS.getOrDefault(from, EnumSet.noneOf(DonationStatus.class)).contains(to);
        }

        public static void assertValidTransition(DonationStatus from, DonationStatus to) {
            if (!canTransition(from, to)) {
                throw new IllegalStateException("Invalid donation state transition from " + from + " to " + to);
            }
        }

        public static boolean isExpired(DonationRecord d) {
            if (d.status() == DonationStatus.EXPIRED) return true;
            if (EnumSet.of(DonationStatus.COMPLETED, DonationStatus.CANCELLED, DonationStatus.DELIVERED).contains(d.status())) {
                return false;
            }
            Instant now = Instant.now();
            return now.isAfter(d.safeDeadline()) || now.isAfter(d.expiryTimestamp());
        }
    }

    public static final class MatchingEngine {
        private static final double EARTH_RADIUS_KM = 6371.0;

        public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
            double dLat = Math.toRadians(lat2 - lat1);
            double dLon = Math.toRadians(lon2 - lon1);
            double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        public static List<NgoMatch> rankSuitableNgos(DonationRecord donation, List<UserAccount> candidates) {
            List<NgoMatch> results = new ArrayList<>();
            for (UserAccount ngo : candidates) {
                if (ngo.role() != UserRole.ROLE_NGO || ngo.verificationStatus() != VerificationStatus.APPROVED) {
                    continue;
                }
                if (ngo.availableCapacityKg() < donation.quantityKg()) {
                    continue;
                }
                double distKm = haversineKm(donation.pickupLat(), donation.pickupLng(), ngo.latitude(), ngo.longitude());
                if (distKm > 30.0) continue;

                int distanceScore = (int) Math.max(0, 50 - distKm * 1.5);
                int capacityScore = (int) Math.min(30, (ngo.availableCapacityKg() / Math.max(1.0, donation.quantityKg())) * 15);
                int urgencyBonus = 20;
                results.add(new NgoMatch(ngo, Math.round(distKm * 10.0) / 10.0, Math.min(100, distanceScore + capacityScore + urgencyBonus)));
            }
            results.sort((a, b) -> Integer.compare(b.score(), a.score()));
            return results;
        }
    }

    // =========================================================================
    // 4. JDBC & MYSQL REPOSITORY LAYER
    // =========================================================================

    public static final class DatabaseManager {
        private final String jdbcUrl;
        private final String dbUser;
        private final String dbPass;

        public DatabaseManager() {
            this.jdbcUrl = System.getenv().getOrDefault("ANNADAAN_DB_URL", "jdbc:mysql://localhost:3306/annadaan_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC");
            this.dbUser = System.getenv().getOrDefault("ANNADAAN_DB_USER", "root");
            this.dbPass = System.getenv().getOrDefault("ANNADAAN_DB_PASS", "");
        }

        public Connection getConnection() throws SQLException {
            return DriverManager.getConnection(jdbcUrl, dbUser, dbPass);
        }

        public void initializeSchemaAndSeeds() throws SQLException {
            try (Connection conn = getConnection(); Statement st = conn.createStatement()) {
                st.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id VARCHAR(64) PRIMARY KEY,
                        full_name VARCHAR(150) NOT NULL,
                        email VARCHAR(190) UNIQUE NOT NULL,
                        phone VARCHAR(40) NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(32) NOT NULL,
                        verification_status VARCHAR(24) NOT NULL,
                        rejection_reason TEXT NULL,
                        organization_name VARCHAR(190) NULL,
                        reference_number VARCHAR(80) UNIQUE NULL,
                        city VARCHAR(80) NOT NULL,
                        address VARCHAR(255) NOT NULL,
                        latitude DOUBLE NOT NULL,
                        longitude DOUBLE NOT NULL,
                        available_capacity_kg DOUBLE DEFAULT 0,
                        beneficiaries_count INT DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """);

                st.execute("""
                    CREATE TABLE IF NOT EXISTS verification_records (
                        id VARCHAR(64) PRIMARY KEY,
                        record_type VARCHAR(24) NOT NULL,
                        license_number VARCHAR(80) UNIQUE NOT NULL,
                        official_name VARCHAR(190) NOT NULL,
                        issuing_authority VARCHAR(190) NOT NULL,
                        state_district VARCHAR(120) NOT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        is_test_record BOOLEAN DEFAULT TRUE
                    )
                """);

                st.execute("""
                    CREATE TABLE IF NOT EXISTS donations (
                        id VARCHAR(64) PRIMARY KEY,
                        donor_id VARCHAR(64) NOT NULL,
                        donor_name VARCHAR(190) NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        category VARCHAR(64) NOT NULL,
                        is_vegetarian BOOLEAN DEFAULT TRUE,
                        quantity_kg DOUBLE NOT NULL,
                        estimated_servings INT NOT NULL,
                        safe_consumption_deadline TIMESTAMP NOT NULL,
                        expiry_timestamp TIMESTAMP NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        allocated_ngo_id VARCHAR(64) NULL,
                        allocated_ngo_name VARCHAR(190) NULL,
                        assigned_volunteer_id VARCHAR(64) NULL,
                        assigned_volunteer_name VARCHAR(150) NULL,
                        pickup_qr_code VARCHAR(80) NOT NULL,
                        delivery_qr_code VARCHAR(80) NOT NULL,
                        pickup_city VARCHAR(80) NOT NULL,
                        pickup_address VARCHAR(255) NOT NULL,
                        pickup_lat DOUBLE NOT NULL,
                        pickup_lng DOUBLE NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (donor_id) REFERENCES users(id)
                    )
                """);

                st.execute("""
                    CREATE TABLE IF NOT EXISTS food_requests (
                        id VARCHAR(64) PRIMARY KEY,
                        donation_id VARCHAR(64) NOT NULL,
                        ngo_id VARCHAR(64) NOT NULL,
                        ngo_name VARCHAR(190) NOT NULL,
                        requested_quantity_kg DOUBLE NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        rejection_reason TEXT NULL,
                        request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (donation_id) REFERENCES donations(id),
                        FOREIGN KEY (ngo_id) REFERENCES users(id)
                    )
                """);

                st.execute("""
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id VARCHAR(64) PRIMARY KEY,
                        actor_user_id VARCHAR(64) NULL,
                        actor_role VARCHAR(32) NOT NULL,
                        actor_name VARCHAR(150) NOT NULL,
                        action VARCHAR(80) NOT NULL,
                        target_type VARCHAR(64) NOT NULL,
                        target_id VARCHAR(64) NOT NULL,
                        details TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """);

                st.execute("""
                    CREATE TABLE IF NOT EXISTS complaints (
                        id VARCHAR(64) PRIMARY KEY,
                        reporter_user_id VARCHAR(64) NOT NULL,
                        reporter_name VARCHAR(150) NOT NULL,
                        subject VARCHAR(190) NOT NULL,
                        description TEXT NOT NULL,
                        status VARCHAR(32) NOT NULL,
                        resolution_note TEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """);

                seedDefaultData(conn);
            }
        }

        private void seedDefaultData(Connection conn) throws SQLException {
            try (PreparedStatement check = conn.prepareStatement("SELECT COUNT(*) FROM users");
                 ResultSet rs = check.executeQuery()) {
                if (rs.next() && rs.getInt(1) > 0) return;
            }

            conn.setAutoCommit(false);
            try {
                // Fictional TEST verification registry records
                try (PreparedStatement vr = conn.prepareStatement(
                        "INSERT INTO verification_records (id, record_type, license_number, official_name, issuing_authority, state_district) VALUES (?, ?, ?, ?, ?, ?)")) {
                    Object[][] records = {
                            {"vr-ngo-1", "NGO", "TEST-NGO-2026-001", "Sneha Orphanage & Child Care", "Registrar of Societies, Andhra Pradesh", "Mangalagiri, Andhra Pradesh"},
                            {"vr-ngo-2", "NGO", "TEST-NGO-2026-004", "Karuna Seva Shelter", "Registrar of Societies, Andhra Pradesh", "Mangalagiri, Andhra Pradesh"},
                            {"vr-ngo-3", "NGO", "TEST-NGO-2026-005", "Asha Orphanage Trust", "Registrar of Societies, Andhra Pradesh", "Amaravati, Andhra Pradesh"},
                            {"vr-rest-1", "RESTAURANT", "TEST-FSSAI-1001", "Taj Krishna Banquet Kitchens", "FSSAI Andhra Pradesh", "Mangalagiri, Andhra Pradesh"},
                            {"vr-rest-2", "RESTAURANT", "TEST-FSSAI-1003", "Minerva Grand Hospitality", "FSSAI Andhra Pradesh", "Amaravati, Andhra Pradesh"}
                    };
                    for (Object[] rec : records) {
                        for (int i = 0; i < rec.length; i++) vr.setObject(i + 1, rec[i]);
                        vr.addBatch();
                    }
                    vr.executeBatch();
                }

                // Seed initial operational accounts (SRM University AP / Mangalagiri / Amaravati corridor)
                try (PreparedStatement u = conn.prepareStatement(
                        "INSERT INTO users (id, full_name, email, phone, password_hash, role, verification_status, organization_name, reference_number, city, address, latitude, longitude, available_capacity_kg, beneficiaries_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                    insertUser(u, "user-admin", "Platform Administrator", "admin@annadaan.org", "+91-8645-240-900",
                            PasswordHasher.hash("Admin@Annadaan2026"), UserRole.ROLE_ADMIN, VerificationStatus.APPROVED,
                            "Annadaan Central Operations", null, "Mangalagiri", "SRM University AP Campus Hub, Neerukonda", 16.4649, 80.5083, 0, 0);
                    insertUser(u, "user-rest-1", "Vikramaditya Rao", "events@tajkrishna.com", "+91-98490-11223",
                            PasswordHasher.hash("Partner@123"), UserRole.ROLE_RESTAURANT, VerificationStatus.APPROVED,
                            "Taj Krishna Banquet Kitchens", "TEST-FSSAI-1001", "Mangalagiri", "Near SRM University AP Main Gate, Neerukonda", 16.4662, 80.5098, 0, 0);
                    insertUser(u, "user-ngo-1", "Meera Devi", "care@snehaorphanage.org", "+91-98480-99887",
                            PasswordHasher.hash("Partner@123"), UserRole.ROLE_NGO, VerificationStatus.APPROVED,
                            "Sneha Orphanage & Child Care", "TEST-NGO-2026-001", "Mangalagiri", "Neerukonda Welfare Enclave, Mangalagiri", 16.4618, 80.5142, 160, 180);
                    insertUser(u, "user-ngo-pending", "Radha Krishna", "pending@ashaorphanage.org", "+91-91210-33445",
                            PasswordHasher.hash("Partner@123"), UserRole.ROLE_NGO, VerificationStatus.PENDING,
                            "Asha Orphanage Trust", "TEST-NGO-2026-005", "Amaravati", "Mandadam Road, Amaravati Capital Region", 16.5060, 80.5210, 80, 90);
                    insertUser(u, "user-ind-1", "Rajesh Verma", "rajesh.verma@gmail.com", "+91-99080-77665",
                            PasswordHasher.hash("Donor@123"), UserRole.ROLE_INDIVIDUAL, VerificationStatus.APPROVED,
                            "Rajesh Verma", null, "Mangalagiri", "Kuragallu Villas, Mangalagiri-Amaravati Road", 16.4585, 80.5235, 0, 0);
                    insertUser(u, "user-vol-1", "Karthik Varma", "karthik.rescue@gmail.com", "+91-97010-22334",
                            PasswordHasher.hash("Volunteer@123"), UserRole.ROLE_VOLUNTEER, VerificationStatus.APPROVED,
                            "Karthik Varma", null, "Mangalagiri", "SRM University AP Circle, Neerukonda", 16.4680, 80.5115, 0, 0);
                }

                // Seed initial active donation
                try (PreparedStatement d = conn.prepareStatement(
                        "INSERT INTO donations (id, donor_id, donor_name, title, category, is_vegetarian, quantity_kg, estimated_servings, safe_consumption_deadline, expiry_timestamp, status, pickup_qr_code, delivery_qr_code, pickup_city, pickup_address, pickup_lat, pickup_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                    Timestamp safe = Timestamp.from(Instant.now().plus(6, ChronoUnit.HOURS));
                    Timestamp exp = Timestamp.from(Instant.now().plus(9, ChronoUnit.HOURS));
                    d.setString(1, "DON-2026-8801");
                    d.setString(2, "user-rest-1");
                    d.setString(3, "Taj Krishna Banquet Kitchens");
                    d.setString(4, "University Convocation Paneer Pulao & Dal");
                    d.setString(5, "COOKED_MEALS");
                    d.setBoolean(6, true);
                    d.setDouble(7, 45.0);
                    d.setInt(8, 120);
                    d.setTimestamp(9, safe);
                    d.setTimestamp(10, exp);
                    d.setString(11, DonationStatus.AVAILABLE.name());
                    d.setString(12, "ANND-PICKUP-8801");
                    d.setString(13, "ANND-DELIVER-8801");
                    d.setString(14, "Mangalagiri");
                    d.setString(15, "Near SRM University AP Main Gate, Neerukonda");
                    d.setDouble(16, 16.4662);
                    d.setDouble(17, 80.5098);
                    d.executeUpdate();
                }

                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(true);
            }
        }

        private static void insertUser(PreparedStatement ps, String id, String name, String email, String phone,
                                       String hash, UserRole role, VerificationStatus vs, String orgName, String refNo,
                                       String city, String address, double lat, double lng, double capKg, int benCount) throws SQLException {
            ps.setString(1, id);
            ps.setString(2, name);
            ps.setString(3, email);
            ps.setString(4, phone);
            ps.setString(5, hash);
            ps.setString(6, role.name());
            ps.setString(7, vs.name());
            ps.setString(8, orgName);
            ps.setString(9, refNo);
            ps.setString(10, city);
            ps.setString(11, address);
            ps.setDouble(12, lat);
            ps.setDouble(13, lng);
            ps.setDouble(14, capKg);
            ps.setInt(15, benCount);
            ps.executeUpdate();
        }
    }

    // =========================================================================
    // 5. SERVICE LAYER (AUTHENTICATION, WORKFLOW & ANALYTICS)
    // =========================================================================

    public static final class AnnadaanService {
        private final DatabaseManager db;

        public AnnadaanService(DatabaseManager db) {
            this.db = db;
        }

        public UserAccount login(UserRole selectedRole, String email, String password) throws SQLException {
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")) {
                ps.setString(1, email.trim());
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        throw new IllegalArgumentException("Invalid email or password.");
                    }
                    String hash = rs.getString("password_hash");
                    if (!PasswordHasher.verify(password, hash)) {
                        throw new IllegalArgumentException("Invalid email or password.");
                    }
                    UserRole actualRole = UserRole.valueOf(rs.getString("role"));
                    if (actualRole != selectedRole) {
                        throw new IllegalArgumentException("This account belongs to " + actualRole + ". Switch role tab to sign in.");
                    }
                    VerificationStatus status = VerificationStatus.valueOf(rs.getString("verification_status"));
                    if (status == VerificationStatus.PENDING) {
                        throw new IllegalStateException(selectedRole == UserRole.ROLE_NGO
                                ? "Your NGO verification is pending."
                                : "Your partner verification is pending.");
                    }
                    if (status == VerificationStatus.REJECTED) {
                        throw new IllegalStateException("VERIFICATION_REJECTED: " + Optional.ofNullable(rs.getString("rejection_reason")).orElse("Verification rejected."));
                    }
                    if (status == VerificationStatus.SUSPENDED) {
                        throw new IllegalStateException("This account has been suspended by an administrator.");
                    }
                    return mapUser(rs);
                }
            }
        }

        public String registerPartner(UserRole role, String fullName, String email, String phone, String password,
                                      String orgName, String referenceNumber, String city, String address,
                                      double capacityKg, int beneficiariesCount) throws SQLException {
            if (role == UserRole.ROLE_ADMIN) {
                throw new SecurityException("Administrator accounts cannot be self-registered.");
            }
            String normalizedRef = referenceNumber == null ? "" : referenceNumber.trim().toUpperCase();
            try (Connection conn = db.getConnection()) {
                conn.setAutoCommit(false);
                try {
                    try (PreparedStatement dupEmail = conn.prepareStatement("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")) {
                        dupEmail.setString(1, email.trim());
                        if (dupEmail.executeQuery().next()) {
                            throw new IllegalArgumentException("An account with this email already exists.");
                        }
                    }

                    if (role == UserRole.ROLE_NGO || role == UserRole.ROLE_RESTAURANT) {
                        String expectedType = role == UserRole.ROLE_NGO ? "NGO" : "RESTAURANT";
                        try (PreparedStatement vr = conn.prepareStatement(
                                "SELECT id FROM verification_records WHERE license_number = ? AND record_type = ? AND is_active = TRUE")) {
                            vr.setString(1, normalizedRef);
                            vr.setString(2, expectedType);
                            if (!vr.executeQuery().next()) {
                                throw new IllegalArgumentException(role == UserRole.ROLE_NGO
                                        ? "Invalid NGO registration number."
                                        : "Invalid FSSAI licence number.");
                            }
                        }

                        try (PreparedStatement dupRef = conn.prepareStatement("SELECT id FROM users WHERE reference_number = ?")) {
                            dupRef.setString(1, normalizedRef);
                            if (dupRef.executeQuery().next()) {
                                throw new IllegalArgumentException("This registration or licence number is already linked to another account.");
                            }
                        }
                    }

                    VerificationStatus initialStatus = (role == UserRole.ROLE_INDIVIDUAL)
                            ? VerificationStatus.APPROVED
                            : VerificationStatus.PENDING;

                    String newId = "user-" + UUID.randomUUID().toString().substring(0, 8);
                    try (PreparedStatement ins = conn.prepareStatement(
                            "INSERT INTO users (id, full_name, email, phone, password_hash, role, verification_status, organization_name, reference_number, city, address, latitude, longitude, available_capacity_kg, beneficiaries_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                        ins.setString(1, newId);
                        ins.setString(2, fullName.trim());
                        ins.setString(3, email.trim().toLowerCase());
                        ins.setString(4, phone.trim());
                        ins.setString(5, PasswordHasher.hash(password));
                        ins.setString(6, role.name());
                        ins.setString(7, initialStatus.name());
                        ins.setString(8, orgName.isBlank() ? fullName.trim() : orgName.trim());
                        ins.setString(9, normalizedRef.isBlank() ? null : normalizedRef);
                        ins.setString(10, city.trim());
                        ins.setString(11, address.trim());
                        ins.setDouble(12, 16.4649);
                        ins.setDouble(13, 80.5083);
                        ins.setDouble(14, capacityKg);
                        ins.setInt(15, beneficiariesCount);
                        ins.executeUpdate();
                    }

                    writeAudit(conn, newId, role.name(), orgName, "REGISTER", "USER", newId,
                            "Registered new " + role + " (" + initialStatus + ")");
                    conn.commit();
                    return initialStatus == VerificationStatus.APPROVED
                            ? "Registration complete! You can now access your dashboard."
                            : "Verification pending administrator approval.";
                } catch (SQLException | RuntimeException ex) {
                    conn.rollback();
                    throw ex;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        }

        public List<UserAccount> listUsers() throws SQLException {
            List<UserAccount> list = new ArrayList<>();
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("SELECT * FROM users ORDER BY created_at DESC");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapUser(rs));
            }
            return list;
        }

        public List<DonationRecord> listDonations() throws SQLException {
            expireStaleDonations();
            List<DonationRecord> list = new ArrayList<>();
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("SELECT * FROM donations ORDER BY created_at DESC");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) list.add(mapDonation(rs));
            }
            return list;
        }

        public List<FoodRequestRecord> listRequests() throws SQLException {
            List<FoodRequestRecord> list = new ArrayList<>();
            String sql = """
                SELECT fr.*, d.title AS donation_title
                FROM food_requests fr
                JOIN donations d ON d.id = fr.donation_id
                ORDER BY fr.request_timestamp DESC
            """;
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql);
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new FoodRequestRecord(
                            rs.getString("id"),
                            rs.getString("donation_id"),
                            rs.getString("donation_title"),
                            rs.getString("ngo_id"),
                            rs.getString("ngo_name"),
                            rs.getDouble("requested_quantity_kg"),
                            rs.getString("status"),
                            rs.getString("request_timestamp")
                    ));
                }
            }
            return list;
        }

        public void createDonation(UserAccount donor, String title, String category, boolean veg,
                                   double qtyKg, int servings, int safeHours, DonationStatus initialStatus) throws SQLException {
            String id = "DON-2026-" + (1000 + new SecureRandom().nextInt(9000));
            String suffix = id.substring(id.length() - 4);
            Instant safe = Instant.now().plus(safeHours, ChronoUnit.HOURS);
            Instant expiry = Instant.now().plus(safeHours + 3L, ChronoUnit.HOURS);

            try (Connection conn = db.getConnection()) {
                conn.setAutoCommit(false);
                try (PreparedStatement ps = conn.prepareStatement(
                        "INSERT INTO donations (id, donor_id, donor_name, title, category, is_vegetarian, quantity_kg, estimated_servings, safe_consumption_deadline, expiry_timestamp, status, pickup_qr_code, delivery_qr_code, pickup_city, pickup_address, pickup_lat, pickup_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                    ps.setString(1, id);
                    ps.setString(2, donor.id());
                    ps.setString(3, donor.organizationName() != null ? donor.organizationName() : donor.fullName());
                    ps.setString(4, title.trim());
                    ps.setString(5, category);
                    ps.setBoolean(6, veg);
                    ps.setDouble(7, qtyKg);
                    ps.setInt(8, servings);
                    ps.setTimestamp(9, Timestamp.from(safe));
                    ps.setTimestamp(10, Timestamp.from(expiry));
                    ps.setString(11, initialStatus.name());
                    ps.setString(12, "ANND-PICKUP-" + suffix);
                    ps.setString(13, "ANND-DELIVER-" + suffix);
                    ps.setString(14, donor.city());
                    ps.setString(15, donor.address());
                    ps.setDouble(16, donor.latitude());
                    ps.setDouble(17, donor.longitude());
                    ps.executeUpdate();
                    writeAudit(conn, donor.id(), donor.role().name(), donor.fullName(), "CREATE_DONATION", "DONATION", id,
                            "Created donation " + title + " (" + initialStatus + ")");
                    conn.commit();
                } catch (SQLException ex) {
                    conn.rollback();
                    throw ex;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        }

        public void requestDonation(UserAccount ngo, String donationId, double requestedQtyKg) throws SQLException {
            List<DonationRecord> all = listDonations();
            DonationRecord d = all.stream().filter(x -> x.id().equals(donationId)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Donation not found."));
            if (d.status() != DonationStatus.AVAILABLE || DonationStateMachine.isExpired(d)) {
                throw new IllegalStateException("This donation is unavailable or expired.");
            }
            if (requestedQtyKg <= 0 || requestedQtyKg > d.quantityKg() || requestedQtyKg > ngo.availableCapacityKg()) {
                throw new IllegalArgumentException("Requested quantity exceeds available food or NGO capacity.");
            }
            String reqId = "REQ-2026-" + (100 + new SecureRandom().nextInt(9000));
            try (Connection conn = db.getConnection()) {
                conn.setAutoCommit(false);
                try {
                    try (PreparedStatement ins = conn.prepareStatement(
                            "INSERT INTO food_requests (id, donation_id, ngo_id, ngo_name, requested_quantity_kg, status) VALUES (?, ?, ?, ?, ?, 'PENDING')")) {
                        ins.setString(1, reqId);
                        ins.setString(2, donationId);
                        ins.setString(3, ngo.id());
                        ins.setString(4, ngo.organizationName() != null ? ngo.organizationName() : ngo.fullName());
                        ins.setDouble(5, requestedQtyKg);
                        ins.executeUpdate();
                    }
                    try (PreparedStatement upd = conn.prepareStatement("UPDATE donations SET status = 'REQUESTED' WHERE id = ?")) {
                        upd.setString(1, donationId);
                        upd.executeUpdate();
                    }
                    writeAudit(conn, ngo.id(), ngo.role().name(), ngo.organizationName(), "REQUEST_DONATION", "DONATION", donationId,
                            "Requested " + requestedQtyKg + " kg.");
                    conn.commit();
                } catch (SQLException ex) {
                    conn.rollback();
                    throw ex;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        }

        public void approveRequestAndAssign(UserAccount actor, String requestId, String volunteerId) throws SQLException {
            try (Connection conn = db.getConnection()) {
                conn.setAutoCommit(false);
                try {
                    String donationId;
                    String ngoId;
                    String ngoName;
                    try (PreparedStatement getReq = conn.prepareStatement("SELECT donation_id, ngo_id, ngo_name FROM food_requests WHERE id = ?")) {
                        getReq.setString(1, requestId);
                        try (ResultSet rs = getReq.executeQuery()) {
                            if (!rs.next()) throw new IllegalArgumentException("Request not found.");
                            donationId = rs.getString("donation_id");
                            ngoId = rs.getString("ngo_id");
                            ngoName = rs.getString("ngo_name");
                        }
                    }

                    UserAccount vol = listUsers().stream()
                            .filter(u -> u.id().equals(volunteerId) || (volunteerId == null && u.role() == UserRole.ROLE_VOLUNTEER && u.verificationStatus() == VerificationStatus.APPROVED))
                            .findFirst().orElse(null);

                    try (PreparedStatement updReq = conn.prepareStatement("UPDATE food_requests SET status = 'APPROVED' WHERE id = ?")) {
                        updReq.setString(1, requestId);
                        updReq.executeUpdate();
                    }

                    DonationStatus next = vol != null ? DonationStatus.ASSIGNED : DonationStatus.APPROVED;
                    try (PreparedStatement updDon = conn.prepareStatement(
                            "UPDATE donations SET status = ?, allocated_ngo_id = ?, allocated_ngo_name = ?, assigned_volunteer_id = ?, assigned_volunteer_name = ? WHERE id = ?")) {
                        updDon.setString(1, next.name());
                        updDon.setString(2, ngoId);
                        updDon.setString(3, ngoName);
                        updDon.setString(4, vol != null ? vol.id() : null);
                        updDon.setString(5, vol != null ? vol.fullName() : null);
                        updDon.setString(6, donationId);
                        updDon.executeUpdate();
                    }

                    writeAudit(conn, actor.id(), actor.role().name(), actor.fullName(), "APPROVE_REQUEST", "FOOD_REQUEST", requestId,
                            "Approved allocation for " + ngoName + " (" + next + ")");
                    conn.commit();
                } catch (SQLException | RuntimeException ex) {
                    conn.rollback();
                    throw ex;
                } finally {
                    conn.setAutoCommit(true);
                }
            }
        }

        public void verifyPickupQr(UserAccount vol, String donationId, String token) throws SQLException {
            transitionWithQr(vol, donationId, token, DonationStatus.PICKED_UP, true);
        }

        public void verifyDeliveryQr(UserAccount vol, String donationId, String token) throws SQLException {
            transitionWithQr(vol, donationId, token, DonationStatus.DELIVERED, false);
        }

        public void confirmReceipt(UserAccount ngo, String donationId) throws SQLException {
            DonationRecord d = listDonations().stream().filter(x -> x.id().equals(donationId)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Donation not found."));
            DonationStateMachine.assertValidTransition(d.status(), DonationStatus.COMPLETED);
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("UPDATE donations SET status = 'COMPLETED' WHERE id = ?")) {
                ps.setString(1, donationId);
                ps.executeUpdate();
                writeAudit(conn, ngo.id(), ngo.role().name(), ngo.organizationName(), "COMPLETE_DONATION", "DONATION", donationId,
                        "Confirmed receipt and completion.");
            }
        }

        public void updateVerification(UserAccount admin, String targetUserId, VerificationStatus status, String reason) throws SQLException {
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("UPDATE users SET verification_status = ?, rejection_reason = ? WHERE id = ?")) {
                ps.setString(1, status.name());
                ps.setString(2, status == VerificationStatus.REJECTED ? reason : null);
                ps.setString(3, targetUserId);
                ps.executeUpdate();
                writeAudit(conn, admin.id(), admin.role().name(), admin.fullName(), "VERIFICATION_" + status, "USER", targetUserId,
                        "Marked user " + targetUserId + " as " + status);
            }
        }

        public List<String> listAuditLogs() throws SQLException {
            List<String> logs = new ArrayList<>();
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("SELECT created_at, actor_role, action, details FROM audit_logs ORDER BY created_at DESC LIMIT 100");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    logs.add("[" + rs.getString("created_at") + "] " + rs.getString("actor_role")
                            + " · " + rs.getString("action") + " — " + rs.getString("details"));
                }
            }
            return logs;
        }

        private void transitionWithQr(UserAccount vol, String donationId, String scannedQr, DonationStatus next, boolean isPickup) throws SQLException {
            DonationRecord d = listDonations().stream().filter(x -> x.id().equals(donationId)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Donation not found."));
            String expected = isPickup ? d.pickupQrCode() : d.deliveryQrCode();
            if (!expected.equals(scannedQr.trim())) {
                throw new IllegalArgumentException("Invalid QR verification token.");
            }
            DonationStateMachine.assertValidTransition(d.status(), next);
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement("UPDATE donations SET status = ? WHERE id = ?")) {
                ps.setString(1, next.name());
                ps.setString(2, donationId);
                ps.executeUpdate();
                writeAudit(conn, vol.id(), vol.role().name(), vol.fullName(), next.name(), "DONATION", donationId,
                        (isPickup ? "Pickup" : "Delivery") + " QR verified.");
            }
        }

        private void expireStaleDonations() throws SQLException {
            try (Connection conn = db.getConnection();
                 PreparedStatement ps = conn.prepareStatement(
                         "UPDATE donations SET status = 'EXPIRED' WHERE status IN ('DRAFT','AVAILABLE','REQUESTED','APPROVED') AND (safe_consumption_deadline < CURRENT_TIMESTAMP OR expiry_timestamp < CURRENT_TIMESTAMP)")) {
                ps.executeUpdate();
            }
        }

        private static void writeAudit(Connection conn, String actorId, String actorRole, String actorName,
                                       String action, String targetType, String targetId, String details) throws SQLException {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO audit_logs (id, actor_user_id, actor_role, actor_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
                ps.setString(1, "AUD-" + UUID.randomUUID().toString().substring(0, 8));
                ps.setString(2, actorId);
                ps.setString(3, actorRole);
                ps.setString(4, actorName != null ? actorName : "System");
                ps.setString(5, action);
                ps.setString(6, targetType);
                ps.setString(7, targetId);
                ps.setString(8, details);
                ps.executeUpdate();
            }
        }

        private static UserAccount mapUser(ResultSet rs) throws SQLException {
            return new UserAccount(
                    rs.getString("id"),
                    rs.getString("full_name"),
                    rs.getString("email"),
                    rs.getString("phone"),
                    UserRole.valueOf(rs.getString("role")),
                    VerificationStatus.valueOf(rs.getString("verification_status")),
                    rs.getString("rejection_reason"),
                    rs.getString("organization_name"),
                    rs.getString("reference_number"),
                    rs.getString("city"),
                    rs.getString("address"),
                    rs.getDouble("latitude"),
                    rs.getDouble("longitude"),
                    rs.getDouble("available_capacity_kg"),
                    rs.getInt("beneficiaries_count")
            );
        }

        private static DonationRecord mapDonation(ResultSet rs) throws SQLException {
            return new DonationRecord(
                    rs.getString("id"),
                    rs.getString("donor_id"),
                    rs.getString("donor_name"),
                    rs.getString("title"),
                    rs.getString("category"),
                    rs.getBoolean("is_vegetarian"),
                    rs.getDouble("quantity_kg"),
                    rs.getInt("estimated_servings"),
                    rs.getTimestamp("safe_consumption_deadline").toInstant(),
                    rs.getTimestamp("expiry_timestamp").toInstant(),
                    DonationStatus.valueOf(rs.getString("status")),
                    rs.getString("allocated_ngo_id"),
                    rs.getString("allocated_ngo_name"),
                    rs.getString("assigned_volunteer_id"),
                    rs.getString("assigned_volunteer_name"),
                    rs.getString("pickup_qr_code"),
                    rs.getString("delivery_qr_code"),
                    rs.getString("pickup_city"),
                    rs.getString("pickup_address"),
                    rs.getDouble("pickup_lat"),
                    rs.getDouble("pickup_lng")
            );
        }
    }

    // =========================================================================
    // 6. JAVAFX GUI APPLICATION (5-ROLE STARTUP POPUP + AUTH + 5 DASHBOARDS)
    // =========================================================================

    private Stage primaryStage;
    private AnnadaanService service;
    private UserAccount currentUser;

    @Override
    public void start(Stage stage) {
        this.primaryStage = stage;
        DatabaseManager db = new DatabaseManager();
        this.service = new AnnadaanService(db);

        try {
            db.initializeSchemaAndSeeds();
        } catch (SQLException ex) {
            showAlert(Alert.AlertType.ERROR, "Database Connection Error",
                    "Could not initialize MySQL schema. Verify ANNADAAN_DB_URL / credentials.\n" + ex.getMessage());
        }

        primaryStage.setTitle("ANNADAAN — Every Meal Deserves a Purpose");
        showRoleSelectionPopup();
    }

    /**
     * FIRST SCREEN: Animated 5-Role Selection Popup Modal.
     */
    private void showRoleSelectionPopup() {
        VBox root = new VBox(20);
        root.setAlignment(Pos.CENTER);
        root.setPadding(new Insets(36));
        root.setStyle("-fx-background-color: #09090b;");

        Label title = new Label("Welcome to ANNADAAN");
        title.setStyle("-fx-font-size: 28px; -fx-font-weight: bold; -fx-text-fill: #ffffff;");

        Label subtitle = new Label("Choose how you want to participate in food rescue.");
        subtitle.setStyle("-fx-font-size: 14px; -fx-text-fill: #a1a1aa;");

        GridPane grid = new GridPane();
        grid.setHgap(16);
        grid.setVgap(16);
        grid.setAlignment(Pos.CENTER);

        record RoleCardDef(UserRole role, String label, String desc, String accent) {}
        List<RoleCardDef> cards = List.of(
                new RoleCardDef(UserRole.ROLE_RESTAURANT, "Restaurant / Food Provider", "Donate surplus buffet meals & manage pickups", "#10b981"),
                new RoleCardDef(UserRole.ROLE_NGO, "NGO / Food Receiver", "Receive food & coordinate shelter delivery", "#f59e0b"),
                new RoleCardDef(UserRole.ROLE_INDIVIDUAL, "Individual Donor", "Share excess food from family events & parties", "#14b8a6"),
                new RoleCardDef(UserRole.ROLE_VOLUNTEER, "Volunteer", "Collect verified pickups & deliver safely", "#0ea5e9"),
                new RoleCardDef(UserRole.ROLE_ADMIN, "Administrator", "Verify partners, monitor rescues & audit operations", "#f43f5e")
        );

        for (int i = 0; i < cards.size(); i++) {
            RoleCardDef def = cards.get(i);
            VBox card = new VBox(8);
            card.setPrefWidth(260);
            card.setPrefHeight(135);
            card.setPadding(new Insets(18));
            card.setStyle("-fx-background-color: #18181b; -fx-background-radius: 14; -fx-border-color: #27272a; -fx-border-radius: 14; -fx-cursor: hand;");

            Label roleTitle = new Label(def.label());
            roleTitle.setStyle("-fx-font-size: 15px; -fx-font-weight: bold; -fx-text-fill: " + def.accent() + ";");
            roleTitle.setWrapText(true);

            Label roleDesc = new Label(def.desc());
            roleDesc.setStyle("-fx-font-size: 12px; -fx-text-fill: #a1a1aa;");
            roleDesc.setWrapText(true);

            card.getChildren().addAll(roleTitle, roleDesc);
            card.setOnMouseClicked(e -> showRoleAuthScreen(def.role(), def.label()));

            grid.add(card, i % 3, i / 3);
        }

        root.getChildren().addAll(title, subtitle, grid);

        // Entrance animation
        root.setOpacity(0);
        root.setScaleX(0.95);
        root.setScaleY(0.95);
        FadeTransition ft = new FadeTransition(Duration.millis(280), root);
        ft.setToValue(1.0);
        ScaleTransition st = new ScaleTransition(Duration.millis(280), root);
        st.setToX(1.0);
        st.setToY(1.0);
        new ParallelTransition(ft, st).play();

        primaryStage.setScene(new Scene(root, 960, 620));
        primaryStage.show();
    }

    /**
     * ROLE AUTH SCREEN: Dedicated Login & Registration (Admin login-only).
     */
    private void showRoleAuthScreen(UserRole role, String roleLabel) {
        VBox container = new VBox(16);
        container.setAlignment(Pos.CENTER);
        container.setPadding(new Insets(28));
        container.setStyle("-fx-background-color: #09090b;");

        Button backBtn = new Button("← Change Role");
        backBtn.setOnAction(e -> showRoleSelectionPopup());

        Label heading = new Label(roleLabel + " Portal");
        heading.setStyle("-fx-font-size: 22px; -fx-font-weight: bold; -fx-text-fill: white;");

        TabPane tabs = new TabPane();
        tabs.setMaxWidth(520);

        // Login Tab
        VBox loginBox = new VBox(10);
        loginBox.setPadding(new Insets(18));
        TextField emailField = new TextField();
        emailField.setPromptText("Email address");
        PasswordField passField = new PasswordField();
        passField.setPromptText("Password");
        Label statusLabel = new Label();
        statusLabel.setStyle("-fx-text-fill: #f87171;");
        statusLabel.setWrapText(true);

        Button loginBtn = new Button("Sign In");
        loginBtn.setMaxWidth(Double.MAX_VALUE);
        loginBtn.setStyle("-fx-background-color: #10b981; -fx-text-fill: #09090b; -fx-font-weight: bold; -fx-padding: 10;");
        loginBtn.setOnAction(e -> {
            try {
                currentUser = service.login(role, emailField.getText(), passField.getText());
                openRoleDashboard();
            } catch (Exception ex) {
                statusLabel.setText(ex.getMessage());
            }
        });
        loginBox.getChildren().addAll(new Label("Email"), emailField, new Label("Password"), passField, statusLabel, loginBtn);

        Tab loginTab = new Tab("Sign In", loginBox);
        loginTab.setClosable(false);
        tabs.getTabs().add(loginTab);

        // Register Tab (Excluded for ROLE_ADMIN)
        if (role != UserRole.ROLE_ADMIN) {
            VBox regBox = new VBox(8);
            regBox.setPadding(new Insets(16));
            TextField regName = new TextField();
            regName.setPromptText("Full Name");
            TextField regOrg = new TextField();
            regOrg.setPromptText("Organization / Shelter Name");
            TextField regEmail = new TextField();
            regEmail.setPromptText("Email");
            TextField regPhone = new TextField();
            regPhone.setPromptText("Phone");
            PasswordField regPass = new PasswordField();
            regPass.setPromptText("Password");
            TextField regRef = new TextField();
            regRef.setPromptText(role == UserRole.ROLE_NGO
                    ? "NGO Registration No (e.g., TEST-NGO-2026-004)"
                    : "FSSAI Licence No (e.g., TEST-FSSAI-1003)");
            TextField regCity = new TextField("Mangalagiri");
            TextField regAddr = new TextField();
            regAddr.setPromptText("Street Address");
            Label regFeedback = new Label();
            regFeedback.setWrapText(true);

            Button regBtn = new Button("Submit Registration");
            regBtn.setStyle("-fx-background-color: #f59e0b; -fx-text-fill: #09090b; -fx-font-weight: bold; -fx-padding: 10;");
            regBtn.setOnAction(e -> {
                try {
                    String msg = service.registerPartner(role, regName.getText(), regEmail.getText(),
                            regPhone.getText(), regPass.getText(), regOrg.getText(), regRef.getText(),
                            regCity.getText(), regAddr.getText(), 100.0, 80);
                    regFeedback.setStyle("-fx-text-fill: #34d399;");
                    regFeedback.setText(msg);
                } catch (Exception ex) {
                    regFeedback.setStyle("-fx-text-fill: #f87171;");
                    regFeedback.setText(ex.getMessage());
                }
            });

            regBox.getChildren().addAll(regName, regOrg, regEmail, regPhone, regPass);
            if (role == UserRole.ROLE_NGO || role == UserRole.ROLE_RESTAURANT) {
                regBox.getChildren().add(regRef);
            }
            regBox.getChildren().addAll(regCity, regAddr, regFeedback, regBtn);

            Tab regTab = new Tab("Create Account", new ScrollPane(regBox));
            regTab.setClosable(false);
            tabs.getTabs().add(regTab);
        }

        container.getChildren().addAll(backBtn, heading, tabs);
        primaryStage.setScene(new Scene(container, 960, 680));
    }

    /**
     * AUTHENTICATED SHELL: Dispatches to the authorized role dashboard.
     */
    private void openRoleDashboard() {
        BorderPane shell = new BorderPane();
        shell.setStyle("-fx-background-color: #09090b;");

        HBox topBar = new HBox(16);
        topBar.setPadding(new Insets(14, 20, 14, 20));
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.setStyle("-fx-background-color: #18181b; -fx-border-color: #27272a; -fx-border-width: 0 0 1 0;");

        Label brand = new Label("ANNADAAN · " + (currentUser.organizationName() != null ? currentUser.organizationName() : currentUser.fullName()));
        brand.setStyle("-fx-font-size: 16px; -fx-font-weight: bold; -fx-text-fill: #10b981;");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Button signOutBtn = new Button("Sign Out");
        signOutBtn.setOnAction(e -> {
            currentUser = null;
            showRoleSelectionPopup();
        });
        topBar.getChildren().addAll(brand, spacer, signOutBtn);
        shell.setTop(topBar);

        VBox content = switch (currentUser.role()) {
            case ROLE_RESTAURANT, ROLE_INDIVIDUAL -> buildDonorDashboard();
            case ROLE_NGO -> buildNgoDashboard();
            case ROLE_VOLUNTEER -> buildVolunteerDashboard();
            case ROLE_ADMIN -> buildAdminDashboard();
        };

        shell.setCenter(new ScrollPane(content));
        primaryStage.setScene(new Scene(shell, 1120, 760));
    }

    private VBox buildDonorDashboard() {
        VBox box = new VBox(16);
        box.setPadding(new Insets(20));

        Label heading = new Label("Food Donation & Matching Console");
        heading.setStyle("-fx-font-size: 18px; -fx-font-weight: bold; -fx-text-fill: white;");

        HBox form = new HBox(10);
        TextField titleField = new TextField();
        titleField.setPromptText("Food item title (e.g., Paneer Pulao)");
        TextField qtyField = new TextField("30");
        qtyField.setPrefWidth(80);
        ComboBox<String> catBox = new ComboBox<>(FXCollections.observableArrayList("COOKED_MEALS", "RICE_AND_BIRYANI", "BAKERY", "PACKAGED"));
        catBox.setValue("COOKED_MEALS");
        CheckBox vegCheck = new CheckBox("Vegetarian");
        vegCheck.setSelected(true);

        TableView<DonationRecord> table = createDonationsTable();
        Button publishBtn = new Button("Publish Donation");
        publishBtn.setStyle("-fx-background-color: #10b981; -fx-text-fill: #09090b; -fx-font-weight: bold;");
        publishBtn.setOnAction(e -> {
            try {
                double kg = Double.parseDouble(qtyField.getText());
                service.createDonation(currentUser, titleField.getText(), catBox.getValue(),
                        vegCheck.isSelected(), kg, (int) Math.round(kg * 2.5), 5, DonationStatus.AVAILABLE);
                titleField.clear();
                table.setItems(FXCollections.observableArrayList(service.listDonations()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "Unable to Publish", ex.getMessage());
            }
        });

        form.getChildren().addAll(titleField, qtyField, catBox, vegCheck, publishBtn);

        TableView<FoodRequestRecord> reqTable = new TableView<>();
        TableColumn<FoodRequestRecord, String> rId = new TableColumn<>("Request");
        rId.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().id()));
        TableColumn<FoodRequestRecord, String> rNgo = new TableColumn<>("NGO");
        rNgo.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().ngoName()));
        TableColumn<FoodRequestRecord, String> rStatus = new TableColumn<>("Status");
        rStatus.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().status()));
        reqTable.getColumns().addAll(rId, rNgo, rStatus);

        Button approveReqBtn = new Button("Approve Selected NGO Request & Assign Courier");
        approveReqBtn.setOnAction(e -> {
            FoodRequestRecord sel = reqTable.getSelectionModel().getSelectedItem();
            if (sel == null) return;
            try {
                service.approveRequestAndAssign(currentUser, sel.id(), null);
                table.setItems(FXCollections.observableArrayList(service.listDonations()));
                reqTable.setItems(FXCollections.observableArrayList(service.listRequests()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "Approval Error", ex.getMessage());
            }
        });

        try {
            table.setItems(FXCollections.observableArrayList(service.listDonations()));
            reqTable.setItems(FXCollections.observableArrayList(service.listRequests()));
        } catch (SQLException ignored) {}

        box.getChildren().addAll(heading, form, table, new Label("Incoming NGO Requests"), reqTable, approveReqBtn);
        return box;
    }

    private VBox buildNgoDashboard() {
        VBox box = new VBox(16);
        box.setPadding(new Insets(20));
        Label heading = new Label("Available Food Rescue Pool (Capacity: " + currentUser.availableCapacityKg() + " kg)");
        heading.setStyle("-fx-font-size: 18px; -fx-font-weight: bold; -fx-text-fill: white;");

        TableView<DonationRecord> table = createDonationsTable();
        try {
            table.setItems(FXCollections.observableArrayList(service.listDonations()));
        } catch (SQLException ignored) {}

        HBox actions = new HBox(10);
        Button reqBtn = new Button("Request Selected Donation");
        reqBtn.setStyle("-fx-background-color: #f59e0b; -fx-text-fill: #09090b; -fx-font-weight: bold;");
        reqBtn.setOnAction(e -> {
            DonationRecord d = table.getSelectionModel().getSelectedItem();
            if (d == null) return;
            try {
                service.requestDonation(currentUser, d.id(), d.quantityKg());
                table.setItems(FXCollections.observableArrayList(service.listDonations()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "Request Error", ex.getMessage());
            }
        });

        Button confirmBtn = new Button("Confirm Receipt (Complete)");
        confirmBtn.setStyle("-fx-background-color: #10b981; -fx-text-fill: #09090b; -fx-font-weight: bold;");
        confirmBtn.setOnAction(e -> {
            DonationRecord d = table.getSelectionModel().getSelectedItem();
            if (d == null) return;
            try {
                service.confirmReceipt(currentUser, d.id());
                table.setItems(FXCollections.observableArrayList(service.listDonations()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "Completion Error", ex.getMessage());
            }
        });

        actions.getChildren().addAll(reqBtn, confirmBtn);
        box.getChildren().addAll(heading, table, actions);
        return box;
    }

    private VBox buildVolunteerDashboard() {
        VBox box = new VBox(16);
        box.setPadding(new Insets(20));
        Label heading = new Label("Volunteer Logistics & QR Verification Console");
        heading.setStyle("-fx-font-size: 18px; -fx-font-weight: bold; -fx-text-fill: white;");

        TableView<DonationRecord> table = createDonationsTable();
        try {
            table.setItems(FXCollections.observableArrayList(service.listDonations()));
        } catch (SQLException ignored) {}

        TextField qrInput = new TextField();
        qrInput.setPromptText("Enter Pickup or Delivery QR Token");

        HBox btns = new HBox(10);
        Button pickupBtn = new Button("Verify Pickup QR");
        pickupBtn.setStyle("-fx-background-color: #10b981; -fx-text-fill: #09090b; -fx-font-weight: bold;");
        pickupBtn.setOnAction(e -> {
            DonationRecord d = table.getSelectionModel().getSelectedItem();
            if (d == null) return;
            try {
                service.verifyPickupQr(currentUser, d.id(), qrInput.getText().isBlank() ? d.pickupQrCode() : qrInput.getText());
                table.setItems(FXCollections.observableArrayList(service.listDonations()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "QR Verification Failed", ex.getMessage());
            }
        });

        Button deliverBtn = new Button("Verify Delivery QR");
        deliverBtn.setStyle("-fx-background-color: #0ea5e9; -fx-text-fill: #09090b; -fx-font-weight: bold;");
        deliverBtn.setOnAction(e -> {
            DonationRecord d = table.getSelectionModel().getSelectedItem();
            if (d == null) return;
            try {
                service.verifyDeliveryQr(currentUser, d.id(), qrInput.getText().isBlank() ? d.deliveryQrCode() : qrInput.getText());
                table.setItems(FXCollections.observableArrayList(service.listDonations()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "QR Verification Failed", ex.getMessage());
            }
        });

        btns.getChildren().addAll(pickupBtn, deliverBtn);
        box.getChildren().addAll(heading, table, qrInput, btns);
        return box;
    }

    private VBox buildAdminDashboard() {
        VBox box = new VBox(16);
        box.setPadding(new Insets(20));
        Label heading = new Label("Operations Administration, Verifications & Analytics");
        heading.setStyle("-fx-font-size: 18px; -fx-font-weight: bold; -fx-text-fill: white;");

        TableView<UserAccount> userTable = new TableView<>();
        TableColumn<UserAccount, String> uOrg = new TableColumn<>("Organization / Name");
        uOrg.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().organizationName()));
        TableColumn<UserAccount, String> uRole = new TableColumn<>("Role");
        uRole.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().role().name()));
        TableColumn<UserAccount, String> uRef = new TableColumn<>("Ref / Licence");
        uRef.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().referenceNumber()));
        TableColumn<UserAccount, String> uStat = new TableColumn<>("Verification");
        uStat.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().verificationStatus().name()));
        userTable.getColumns().addAll(uOrg, uRole, uRef, uStat);

        HBox adminBtns = new HBox(10);
        Button approveBtn = new Button("Approve Partner");
        approveBtn.setStyle("-fx-background-color: #10b981; -fx-text-fill: #09090b; -fx-font-weight: bold;");
        approveBtn.setOnAction(e -> {
            UserAccount sel = userTable.getSelectionModel().getSelectedItem();
            if (sel == null) return;
            try {
                service.updateVerification(currentUser, sel.id(), VerificationStatus.APPROVED, null);
                userTable.setItems(FXCollections.observableArrayList(service.listUsers()));
            } catch (Exception ex) {
                showAlert(Alert.AlertType.ERROR, "Error", ex.getMessage());
            }
        });

        Button rejectBtn = new Button("Reject Partner");
        rejectBtn.setStyle("-fx-background-color: #f43f5e; -fx-text-fill: white; -fx-font-weight: bold;");
        rejectBtn.setOnAction(e -> {
            UserAccount sel = userTable.getSelectionModel().getSelectedItem();
            if (sel == null) return;
            TextInputDialog dialog = new TextInputDialog("Invalid or unverifiable licence document.");
            dialog.setTitle("Reject Verification");
            dialog.setHeaderText("Provide rejection reason for " + sel.organizationName());
            dialog.showAndWait().ifPresent(reason -> {
                try {
                    service.updateVerification(currentUser, sel.id(), VerificationStatus.REJECTED, reason);
                    userTable.setItems(FXCollections.observableArrayList(service.listUsers()));
                } catch (Exception ex) {
                    showAlert(Alert.AlertType.ERROR, "Error", ex.getMessage());
                }
            });
        });

        // Analytics Chart
        CategoryAxis xAxis = new CategoryAxis();
        NumberAxis yAxis = new NumberAxis();
        BarChart<String, Number> chart = new BarChart<>(xAxis, yAxis);
        chart.setTitle("Donations by Status");
        chart.setPrefHeight(220);

        ListView<String> auditList = new ListView<>();
        auditList.setPrefHeight(160);

        try {
            userTable.setItems(FXCollections.observableArrayList(service.listUsers()));
            List<DonationRecord> dons = service.listDonations();
            Map<DonationStatus, Long> counts = new EnumMap<>(DonationStatus.class);
            for (DonationRecord d : dons) counts.merge(d.status(), 1L, Long::sum);
            XYChart.Series<String, Number> series = new XYChart.Series<>();
            counts.forEach((st, c) -> series.getData().add(new XYChart.Data<>(st.name(), c)));
            chart.getData().add(series);
            auditList.setItems(FXCollections.observableArrayList(service.listAuditLogs()));
        } catch (SQLException ignored) {}

        adminBtns.getChildren().addAll(approveBtn, rejectBtn);
        box.getChildren().addAll(heading, userTable, adminBtns, chart, new Label("Audit Trail"), auditList);
        return box;
    }

    private TableView<DonationRecord> createDonationsTable() {
        TableView<DonationRecord> table = new TableView<>();
        TableColumn<DonationRecord, String> idCol = new TableColumn<>("ID");
        idCol.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().id()));
        TableColumn<DonationRecord, String> titleCol = new TableColumn<>("Food Item");
        titleCol.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().title()));
        TableColumn<DonationRecord, String> qtyCol = new TableColumn<>("Qty (kg)");
        qtyCol.setCellValueFactory(c -> new SimpleStringProperty(String.valueOf(c.getValue().quantityKg())));
        TableColumn<DonationRecord, String> statusCol = new TableColumn<>("Status");
        statusCol.setCellValueFactory(c -> new SimpleStringProperty(c.getValue().status().name()));
        TableColumn<DonationRecord, String> ngoCol = new TableColumn<>("Allocated NGO");
        ngoCol.setCellValueFactory(c -> new SimpleStringProperty(Optional.ofNullable(c.getValue().allocatedNgoName()).orElse("—")));
        table.getColumns().addAll(idCol, titleCol, qtyCol, statusCol, ngoCol);
        return table;
    }

    private static void showAlert(Alert.AlertType type, String title, String message) {
        Alert alert = new Alert(type);
        alert.initModality(Modality.APPLICATION_MODAL);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.showAndWait();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
