import { Account } from 'src/app/types';


const AVATAR_COLORS = [
  '#5c6bc0', '#26a69a', '#ef5350', '#ab47bc', '#42a5f5',
  '#ffa726', '#66bb6a', '#8d6e63', '#ec407a',
];

/**
 * Avatars are generated as inline SVG so the simulated backend has zero network
 * dependencies. Swap for real urls when pointing the demo at a live API.
 */
function avatar(firstName: string, lastName: string, index: number): { tiny: string; small: string; medium: string; large: string } {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">',
    `<rect width="128" height="128" fill="${color}"/>`,
    '<text x="64" y="68" fill="#ffffff" font-family="Helvetica,Arial,sans-serif"',
    ' font-size="52" text-anchor="middle" dominant-baseline="middle">',
    initials,
    '</text></svg>',
  ].join('');

  const url = `data:image/svg+xml;base64,${btoa(svg)}`;

  return { tiny: url, small: url, medium: url, large: url };
}

function account(id: number, firstName: string, lastName: string, email: string): Account {
  return {
    id,
    firstName,
    lastName,
    email,
    name: `${firstName} ${lastName}`,
    state: 'active',
    guid: `account-${id}`,
    phone: '4165551200',
    avatar: avatar(firstName, lastName, id),
  };
}

export const accountsData: Account[] = [
  account(1, 'Firestitch', 'Administrator', 'admin@firestitch.com'),
  account(2, 'Amelia', 'Hart', 'amelia.hart@example.com'),
  account(3, 'Marcus', 'Chen', 'marcus.chen@example.com'),
  account(4, 'Priya', 'Raman', 'priya.raman@example.com'),
  account(5, 'Diego', 'Alvarez', 'diego.alvarez@example.com'),
  account(6, 'Nina', 'Kowalski', 'nina.kowalski@example.com'),
  account(7, 'Tomas', 'Brandt', 'tomas.brandt@example.com'),
  account(8, 'Zoe', 'Whitfield', 'zoe.whitfield@example.com'),
];

/**
 * The account the demo is signed in as.
 */
export const sessionAccountId = 1;
