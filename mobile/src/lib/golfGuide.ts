export interface GolfProgramGuide {
  id: string;
  networkOrBank: string;
  programName: string;
  portalLabel: string;
  portalUrl: string;
  helplinePhone: string;
  altPhone?: string;
  supportEmail?: string;
  hours: string;
  bookingWindow: string;
  steps: string[];
  notes: string[];
  courseGroups?: Array<{
    type: 'Games & Lessons' | 'Games Only' | 'Lessons Only';
    cities: Array<{ city: string; courses: string }>;
  }>;
}

export const GOLF_PROGRAM_GUIDES: GolfProgramGuide[] = [
  {
    id: 'rupay_select',
    networkOrBank: 'RuPay',
    programName: 'RuPay Select Golf Program (Truztee)',
    portalLabel: 'rupayselect.truztee.com/#/offers',
    portalUrl: 'https://rupayselect.truztee.com/#/offers',
    helplinePhone: '1800-26-78729',
    altPhone: '+91 40 4917 0200',
    supportEmail: 'golfbooking@truztee.com',
    hours: 'Concierge 24x7 · Truztee Desk Mon–Fri 9 AM – 6 PM',
    bookingWindow: '4 to 15 days prior to play date',
    steps: [
      'Open https://rupayselect.truztee.com/#/offers on phone or browser.',
      'Sign in or register using the mobile number and email linked to your RuPay Select card.',
      'Select Golf benefit under Offers, verify card BIN, and pick city, golf club, date & tee-off/lesson slot.',
      'Complete ₹2 verification hold (if prompted) and present the confirmation SMS/email + photo ID at the club reception.',
    ],
    notes: [
      'Available on eligible RuPay Select credit & debit cards (check quarterly/annual quota per issuing bank).',
      'Solo weekday bookings may be paired into a 2-ball or 4-ball flight at busy clubs.',
    ],
  },
  {
    id: 'mastercard_india',
    networkOrBank: 'Mastercard',
    programName: 'Mastercard World / World Elite Golf Program',
    portalLabel: 'priceless.com (Mastercard Golf)',
    portalUrl: 'https://www.priceless.com',
    helplinePhone: '1800-102-6263',
    supportEmail: 'mastercardindiagolf@apexlynx.net',
    hours: 'Apexlynx Mastercard Concierge',
    bookingWindow: '5 to 10 days before play date',
    steps: [
      'Call Mastercard Golf Concierge toll-free at 1800-102-6263 or email mastercardindiagolf@apexlynx.net.',
      'Share ONLY the first 8 and last 4 digits of your World / World Elite Mastercard (never share full 16 digits or CVV), plus club name, preferred date & time.',
      'Specify whether the request is a complimentary Green Fee round or a Golf Lesson.',
      'Wait for written tee-time confirmation before travelling to the club.',
    ],
    notes: [
      'Standard World tiers typically cover up to 4 complimentary green fee rounds & 12 lessons/year (max 1 game + 1 lesson per month, subject to bank card T&Cs).',
      'Solo bookings are generally not allowed; at least 2 golfers are needed on weekdays.',
    ],
    courseGroups: [
      {
        type: 'Games & Lessons',
        cities: [
          { city: 'Ahmedabad', courses: 'Gladeone Golf Club · Kensville Golf & Country Club · Gulmohar Greens' },
          { city: 'Bengaluru', courses: 'Clover Greens Golf Club (Fri treated as weekend)' },
          { city: 'Delhi NCR', courses: 'Golden Greens (Gurugram) · Jaypee Greens & Jaypee Wishtown (Noida) · Noida Golf Course' },
          { city: 'Hyderabad', courses: 'Boulder Hills Golf Club · Hyderabad Golf Association (HGA)' },
          { city: 'Mumbai', courses: 'Nine Aces Golf Greens & Academy' },
          { city: 'Pune', courses: 'Poona Golf Club' },
          { city: 'Goa', courses: 'The Lalit Golf & Spa Resort' },
          { city: 'Jaipur', courses: 'Rambagh Golf Club' },
          { city: 'Kochi', courses: 'CIAL Golf Club' },
          { city: 'Vadodara', courses: 'Gaekwad Baroda Golf Club' },
          { city: 'Panchkula', courses: 'Panchkula Golf Club' },
        ],
      },
      {
        type: 'Games Only',
        cities: [
          { city: 'Mumbai', courses: 'Bombay Presidency Golf Club — BPGC (weekdays only; closed weekends & holidays)' },
          { city: 'Delhi NCR', courses: 'Classic Golf & Country Club, Gurugram' },
          { city: 'Bengaluru', courses: 'Prestige Augusta (Fri treated as weekend)' },
          { city: 'Pune', courses: 'Oxford Golf Resort · Aamby Valley Golf Club' },
          { city: 'Kolkata', courses: 'Tollygunge Golf Club' },
          { city: 'Visakhapatnam', courses: 'East Point Golf Club' },
        ],
      },
      {
        type: 'Lessons Only',
        cities: [
          { city: 'Delhi NCR', courses: 'Qutab Golf Course · Hamoni Golf Camp (Gurugram)' },
          { city: 'Bengaluru', courses: 'Callaway Performance Centre (KGA) · To the tee · Golfer’s Edge' },
          { city: 'Mumbai', courses: 'Celebrations Sports Club · Golden Swan Golf Academy' },
          { city: 'Ahmedabad', courses: 'Kalhaar Blues & Greens' },
          { city: 'Chennai', courses: 'Pradyumna Prakash at Cosmo TNGF Driving Range' },
          { city: 'Chandigarh', courses: 'CGA Golf Academy' },
          { city: 'Kolkata', courses: 'Protouch Golf Academy' },
        ],
      },
    ],
  },
  {
    id: 'visa_thriwe',
    networkOrBank: 'Visa / Thriwe',
    programName: 'Visa Signature / Infinite Golf (TeePass India)',
    portalLabel: 'teepassindia.thriwe.com',
    portalUrl: 'https://teepassindia.thriwe.com/',
    helplinePhone: '1800-208-7899',
    supportEmail: 'customer.care@thriwe.com',
    hours: 'Mon–Fri, 9:00 AM – 7:00 PM IST',
    bookingWindow: '5 to 15 days in advance',
    steps: [
      'Visit https://teepassindia.thriwe.com/ and sign in via mobile number + OTP.',
      'Add your eligible Visa Signature / Infinite card (₹2 auth charge may apply on first add).',
      'Pick city, participating course, game vs coaching, and request your preferred tee time.',
      'Track approval status on the TeePass dashboard before visiting the club.',
    ],
    notes: [
      'Used by several HDFC, Axis, SBI & IDFC Visa Signature/Infinite variants.',
      'Spend-gated cards unlock quota once prior-cycle spend is settled.',
    ],
  },
  {
    id: 'hdfc_luxury',
    networkOrBank: 'HDFC Bank',
    programName: 'HDFC Infinia & Diners Club Black Golf Desk',
    portalLabel: 'hdfcbank.com (SmartBuy Golf Concierge)',
    portalUrl: 'https://www.hdfcbank.com',
    helplinePhone: '1800-118-887',
    altPhone: '022-42320226',
    supportEmail: 'Infinia.support@smartbuyoffers.co',
    hours: 'HDFC Golf Concierge Desk',
    bookingWindow: '4 to 14 days prior to game',
    steps: [
      'Call HDFC Golf Concierge toll-free at 1800-118-887 (or 022-42320226; overseas +91-22-61717606).',
      'Provide cardholder details, preferred domestic/international course, date and tee time.',
      'Receive confirmation email before arriving at club check-in.',
    ],
    notes: [
      'Infinia Metal & Diners Club Black Metal grant unlimited complimentary games and unlimited domestic coaching.',
      'Check guest green-fee charges separately before adding non-cardholder companions.',
    ],
  },
  {
    id: 'icici_truztee',
    networkOrBank: 'ICICI Bank',
    programName: 'ICICI i-Assist / Truztee Golf Portal',
    portalLabel: 'teetimes.truztee.com',
    portalUrl: 'https://teetimes.truztee.com/',
    helplinePhone: '1800-26-70731',
    altPhone: '022-67872016',
    supportEmail: 'golfbooking@truztee.com',
    hours: 'i-Assist Concierge (Diamant: 1800-267-0732)',
    bookingWindow: '4 to 15 days prior to game',
    steps: [
      'Log in at https://teetimes.truztee.com/ using your ICICI-registered mobile/email, or call 1800-26-70731.',
      'Verify earned rounds in your dashboard (spend-gated tiers require ₹50,000 previous-month spend per round/lesson).',
      'Select domestic or international golf course and submit tee-time request.',
    ],
    notes: [
      'Emeralde Private Metal includes unlimited rounds/lessons without the ₹50k/month gate; Sapphiro/Rubyx/Emeralde plastic track monthly ₹50k spends.',
    ],
  },
  {
    id: 'axis_burgundy',
    networkOrBank: 'Axis Bank',
    programName: 'Axis Burgundy Private / Reserve Golf (Extraordinary Weekends)',
    portalLabel: 'extraordinaryweekends.com',
    portalUrl: 'https://www.extraordinaryweekends.com',
    helplinePhone: '1800-103-4962',
    altPhone: '1800-419-0065',
    supportEmail: 'Premium.Experience@axis.bank.in',
    hours: '24x7 Burgundy / Reserve Concierge',
    bookingWindow: 'Minimum 5 days prior',
    steps: [
      'Book online via extraordinaryweekends.com or call Axis Reserve/Burgundy concierge at 1800-103-4962.',
      'Authenticate with Axis registered details and request preferred domestic/international tee time.',
      'Carry confirmation voucher + card at golf club registration.',
    ],
    notes: [
      'Burgundy Private & Reserve include 50 complimentary rounds/year; Axis Select covers 6 rounds/yr (+6 bonus above ₹3L spend).',
    ],
  },
];

export function matchGolfGuideForCard(
  bank: string,
  network?: string,
  cardName?: string
): GolfProgramGuide {
  const b = bank.toLowerCase();
  const n = (network || '').toLowerCase();
  const c = (cardName || '').toLowerCase();

  if (b.includes('hdfc') && (c.includes('infinia') || c.includes('diners club black') || c.includes('bizblack'))) {
    return GOLF_PROGRAM_GUIDES.find((g) => g.id === 'hdfc_luxury')!;
  }
  if (b.includes('icici')) {
    return GOLF_PROGRAM_GUIDES.find((g) => g.id === 'icici_truztee')!;
  }
  if (b.includes('axis') && (c.includes('reserve') || c.includes('burgundy'))) {
    return GOLF_PROGRAM_GUIDES.find((g) => g.id === 'axis_burgundy')!;
  }
  if (n.includes('rupay') || c.includes('rupay')) {
    return GOLF_PROGRAM_GUIDES.find((g) => g.id === 'rupay_select')!;
  }
  if (n.includes('master')) {
    return GOLF_PROGRAM_GUIDES.find((g) => g.id === 'mastercard_india')!;
  }
  return GOLF_PROGRAM_GUIDES.find((g) => g.id === 'visa_thriwe')!;
}
