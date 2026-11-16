export type LanguageCode = 'en' | 'te' | 'hi';

export interface Translations {
  appName: string;
  tagline: string;
  navHome: string;
  navHowItWorks: string;
  navDonateFood: string;
  navFindNgos: string;
  navImpact: string;
  navLogin: string;
  navLogout: string;
  heroHeadline1: string;
  heroHeadline2: string;
  heroSubtext: string;
  ctaDonateNow: string;
  ctaExploreNgos: string;
  statFoodRescued: string;
  statMealsServed: string;
  statActiveNgos: string;
  statActiveDonations: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;
  dashboardRestaurant: string;
  dashboardNgo: string;
  dashboardIndividual: string;
  dashboardVolunteer: string;
  dashboardAdmin: string;
  createDonation: string;
  myDonations: string;
  availableFood: string;
  requestFood: string;
  confirmReceipt: string;
  pickupScheduled: string;
  inTransit: string;
  delivered: string;
  completed: string;
  expired: string;
  available: string;
  verifiedBadge: string;
  pendingVerification: string;
  scanQrCode: string;
  downloadCertificate: string;
  urgencySafeWindow: string;
  distanceKm: string;
  vegOnly: string;
  nonVeg: string;
}

export const translations: Record<LanguageCode, Translations> = {
  en: {
    appName: 'ANNADAAN',
    tagline: 'Every Meal Deserves a Purpose.',
    navHome: 'Home',
    navHowItWorks: 'How It Works',
    navDonateFood: 'Donate Food',
    navFindNgos: 'Find NGOs',
    navImpact: 'Social Impact',
    navLogin: 'Sign In',
    navLogout: 'Sign Out',
    heroHeadline1: 'FOOD SHOULD FEED PEOPLE.',
    heroHeadline2: 'NOT LANDFILLS.',
    heroSubtext: 'An enterprise-grade technology bridge redirecting surplus meals from restaurants, weddings, and celebrations to verified orphanages and shelters in minutes.',
    ctaDonateNow: 'Donate Surplus Food',
    ctaExploreNgos: 'Find Verified NGOs',
    statFoodRescued: 'Kg Food Rescued',
    statMealsServed: 'Meals Distributed',
    statActiveNgos: 'Verified NGOs & Shelters',
    statActiveDonations: 'Active Rescues Today',
    step1Title: 'Publish Surplus Food',
    step1Desc: 'Restaurants or event hosts log surplus servings with safe consumption timestamps.',
    step2Title: 'Intelligent Matching',
    step2Desc: 'Haversine distance & capacity algorithms alert the highest-priority nearby shelters.',
    step3Title: 'Verified Volunteer Pickup',
    step3Desc: 'Assigned volunteers scan dynamic cryptographic QR codes upon food handover.',
    step4Title: 'Safe Delivery & Impact',
    step4Desc: 'Receiving NGO inspects food, confirms delivery, and updates real-time impact metrics.',
    dashboardRestaurant: 'Restaurant Partner Portal',
    dashboardNgo: 'NGO & Shelter Operations',
    dashboardIndividual: 'Community Donor Portal',
    dashboardVolunteer: 'Volunteer Logistics Hub',
    dashboardAdmin: 'Super Admin Command Center',
    createDonation: 'Create Donation',
    myDonations: 'My Donations',
    availableFood: 'Available Surplus Food',
    requestFood: 'Request Allocation',
    confirmReceipt: 'Confirm Food Receipt',
    pickupScheduled: 'Pickup Scheduled',
    inTransit: 'In Transit',
    delivered: 'Delivered',
    completed: 'Completed',
    expired: 'Expired',
    available: 'Available Now',
    verifiedBadge: 'Verified Partner',
    pendingVerification: 'Pending Verification',
    scanQrCode: 'Scan QR Code',
    downloadCertificate: 'Download Certificate',
    urgencySafeWindow: 'Safe Consumption Window',
    distanceKm: 'km away',
    vegOnly: 'Vegetarian',
    nonVeg: 'Non-Vegetarian',
  },
  te: {
    appName: 'అన్నదానం (ANNADAAN)',
    tagline: 'ప్రతి భోజనానికి ఒక సార్థకత ఉంది.',
    navHome: 'హోమ్',
    navHowItWorks: 'ఇది ఎలా పనిచేస్తుంది',
    navDonateFood: 'ఆహారం దానం చేయండి',
    navFindNgos: 'సేవా సంస్థలు (NGOs)',
    navImpact: 'సామాజిక ప్రభావం',
    navLogin: 'లాగిన్',
    navLogout: 'లాగౌట్',
    heroHeadline1: 'ఆహారం ఆకలిని తీర్చాలి.',
    heroHeadline2: 'చెత్తబుట్టలో చేరకూడదు.',
    heroSubtext: 'హోటళ్ళు, వివాహాలు మరియు వేడుకల మిగులు ఆహారాన్ని సమీపంలోని అనాథాశ్రమాలు మరియు వృద్ధాశ్రమాలకు క్షణాల్లో చేర్చే ఆధునిక సాంకేతిక వేదిక.',
    ctaDonateNow: 'మిగులు ఆహారం దానం చేయండి',
    ctaExploreNgos: 'సేవా సంస్థలను చూడండి',
    statFoodRescued: 'కిలోల ఆహారం కాపాడబడింది',
    statMealsServed: 'అందించిన భోజనాలు',
    statActiveNgos: 'ధృవీకరించబడిన సంస్థలు',
    statActiveDonations: 'ఈ రోజు చురుకైన దానాలు',
    step1Title: 'మిగులు ఆహారాన్ని నమోదు చేయండి',
    step1Desc: 'రెస్టారెంట్లు లేదా వ్యక్తులు భద్రతా సమయ పరిమితులతో వివరాలను నమోదు చేస్తారు.',
    step2Title: 'మేధోపరమైన సరిపోలిక (Matching)',
    step2Desc: 'దూరం మరియు సామర్థ్యం ఆధారంగా సమీపంలోని సంస్థలకు వెంటనే సమాచారం వెళుతుంది.',
    step3Title: 'వాలంటీర్ పికప్ మరియు క్యూఆర్ కోడ్',
    step3Desc: 'వాలంటీర్లు ఆహారాన్ని సేకరించేటప్పుడు డైనమిక్ క్యూఆర్ కోడ్ ద్వారా నిర్ధారిస్తారు.',
    step4Title: 'సురక్షిత డెలివరీ & సర్టిఫికేట్',
    step4Desc: 'ఆశ్రమం ఆహారాన్ని స్వీకరించి నిర్ధారించిన తర్వాత అధికారిక డిజిటల్ సర్టిఫికేట్ జారీ అవుతుంది.',
    dashboardRestaurant: 'రెస్టారెంట్ భాగస్వామి డాష్‌బోర్డ్',
    dashboardNgo: 'ఎన్జీఓ & ఆశ్రమాల డాష్‌బోర్డ్',
    dashboardIndividual: 'వ్యక్తిగత దాతల డాష్‌బోర్డ్',
    dashboardVolunteer: 'వాలంటీర్ సేవా కేంద్రం',
    dashboardAdmin: 'సూపర్ అడ్మిన్ కంట్రోల్ ప్యానెల్',
    createDonation: 'దానం సృష్టించండి',
    myDonations: 'నా దానాలు',
    availableFood: 'లభ్యమయ్యే మిగులు ఆహారం',
    requestFood: 'ఆహారాన్ని అభ్యర్థించండి',
    confirmReceipt: 'ఆహార రసీదును నిర్ధారించండి',
    pickupScheduled: 'పికప్ షెడ్యూల్ చేయబడింది',
    inTransit: 'రవాణాలో ఉంది',
    delivered: 'చేరింది',
    completed: 'పూర్తయింది',
    expired: 'గడువు ముగిసింది',
    available: 'ఇప్పుడు లభ్యం',
    verifiedBadge: 'ధృవీకరించబడిన సంస్థ',
    pendingVerification: 'ధృవీకరణ పెండింగ్‌లో ఉంది',
    scanQrCode: 'క్యూఆర్ కోడ్ స్కాన్ చేయండి',
    downloadCertificate: 'సర్టిఫికేట్ డౌన్‌లోడ్ చేసుకోండి',
    urgencySafeWindow: 'సురక్షిత వినియోగ గడువు',
    distanceKm: 'కి.మీ దూరంలో',
    vegOnly: 'శాకాహారం',
    nonVeg: 'మాంసాహారం',
  },
  hi: {
    appName: 'अन्नदान (ANNADAAN)',
    tagline: 'हर भोजन का एक सार्थक उद्देश्य है।',
    navHome: 'होम',
    navHowItWorks: 'यह कैसे काम करता है',
    navDonateFood: 'भोजन दान करें',
    navFindNgos: 'आश्रम एवं एनजीओ',
    navImpact: 'सामाजिक प्रभाव',
    navLogin: 'साइन इन',
    navLogout: 'साइन आउट',
    heroHeadline1: 'भोजन पेट भरने के लिए है।',
    heroHeadline2: 'कचरे में जाने के लिए नहीं।',
    heroSubtext: 'रेस्तरां, शादियों और आयोजनों से बचे अतिरिक्त पौष्टिक भोजन को निकटतम अनाथालयों और आश्रयों तक मिनटों में पहुँचाने वाला तकनीक-संचालित मंच।',
    ctaDonateNow: 'अतिरिक्त भोजन दान करें',
    ctaExploreNgos: 'सत्यापित एनजीओ खोजें',
    statFoodRescued: 'किलो भोजन बचाया गया',
    statMealsServed: 'वितरित किए गए भोजन',
    statActiveNgos: 'सत्यापित एनजीओ व आश्रम',
    statActiveDonations: 'आज सक्रिय भोजन बचाओ कार्य',
    step1Title: 'अतिरिक्त भोजन दर्ज करें',
    step1Desc: 'भोजन की मात्रा, प्रकार और सुरक्षित उपभोग समय के साथ दान पोस्ट करें।',
    step2Title: 'स्मार्ट एनजीओ मैचिंग',
    step2Desc: 'दूरी और क्षमता के आधार पर नजदीकी जरूरतमंद आश्रमों से तुरंत मिलान।',
    step3Title: 'सत्यापित वॉलंटियर पिकअप',
    step3Desc: 'कलेक्शन के समय डायनामिक क्यूआर कोड स्कैन करके सुरक्षित हैंडओवर।',
    step4Title: 'सुरक्षित वितरण एवं प्रभाव',
    step4Desc: 'भोजन मिलने पर आश्रम पुष्टि करता है और रियल-टाइम सोशल इम्पैक्ट अपडेट होता है।',
    dashboardRestaurant: 'रेस्तरां पार्टनर डैशबोर्ड',
    dashboardNgo: 'एनजीओ एवं आश्रय केंद्र पोर्टल',
    dashboardIndividual: 'नागरिक दानकर्ता पोर्टल',
    dashboardVolunteer: 'वॉलंटियर लॉजिस्टिक्स हब',
    dashboardAdmin: 'सुपर एडमिन कमांड सेंटर',
    createDonation: 'दान दर्ज करें',
    myDonations: 'मेरे दान',
    availableFood: 'उपलब्ध अतिरिक्त भोजन',
    requestFood: 'भोजन का अनुरोध करें',
    confirmReceipt: 'भोजन प्राप्ति की पुष्टि करें',
    pickupScheduled: 'पिकअप निर्धारित',
    inTransit: 'रास्ते में है',
    delivered: 'वितरित हो चुका',
    completed: 'सफलतापूर्वक संपन्न',
    expired: 'समय समाप्त',
    available: 'अभी उपलब्ध',
    verifiedBadge: 'सत्यापित संगठन',
    pendingVerification: 'सत्यापन प्रक्रियाधीन',
    scanQrCode: 'क्यूआर कोड स्कैन करें',
    downloadCertificate: 'प्रमाणपत्र डाउनलोड करें',
    urgencySafeWindow: 'सुरक्षित उपभोग समय सीमा',
    distanceKm: 'किमी दूर',
    vegOnly: 'शाकाहारी',
    nonVeg: 'मांसाहारी',
  },
};
