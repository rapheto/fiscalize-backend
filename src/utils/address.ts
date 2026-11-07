// Created by AI.
export type AddressInput = {
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  complemento?: string | null;
};

// Created by AI.
function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Created by AI.
export function normalizeCep(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

// Created by AI.
export function normalizeBairro(value: string | null | undefined): string | null {
  const normalized = clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');

  return normalized.length > 0 ? normalized : null;
}

// Created by AI.
export function composeAddress(address: AddressInput): string {
  const rua = clean(address.rua);
  const numero = clean(address.numero);
  const bairro = clean(address.bairro);
  const cidade = clean(address.cidade);
  const estado = clean(address.estado).toUpperCase();
  const complemento = clean(address.complemento);
  const cep = normalizeCep(address.cep);

  const street = [rua, numero].filter(Boolean).join(', ');
  const cityState = [cidade, estado].filter(Boolean).join(' - ');
  const districtAndCity = [bairro, cityState].filter(Boolean).join(', ');
  const cepLabel = cep ? `CEP ${cep}` : '';

  const parts = [street, districtAndCity, cepLabel].filter(Boolean);
  const base = parts.join(', ');

  if (!complemento) return base;
  return base ? `${base}, ${complemento}` : complemento;
}

// Created by AI.
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;

  // Limites plausíveis do território brasileiro.
  return latitude >= -33.75 && latitude <= 5.28 && longitude >= -74 && longitude <= -28.8;
}
