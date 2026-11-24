import { registerProvider } from '@/lib/provider';
import { hslProvider } from './hsl';
import { vietnamProvider } from './vietnam';

// Register built-in providers. The default provider is HSL (Helsinki).
registerProvider(hslProvider);
registerProvider(vietnamProvider);
