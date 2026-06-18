import { MongoClient, Db, MongoServerSelectionError } from 'mongodb';
import { warn as logWarn, error as logError } from '@/lib/logger';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'prolevel';

if (!uri) {
  logWarn(
    'MONGODB_URI is not set. Database features (history persistence) will not work until it is configured in .env.local or your deployment environment.'
  );
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;
let _mongoGuidanceLogged = false;

function buildMongoOptions() {
  const serverSelectionTimeoutMS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000);
  const connectTimeoutMS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 5000);
  return {
    serverSelectionTimeoutMS,
    connectTimeoutMS,
    // Keep sockets alive longer for streaming responses
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 30000),
  } as const;
}

export function getMongoClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  const options = buildMongoOptions();

  if (process.env.NODE_ENV === 'development') {
    // Reuse client across hot reloads in dev
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options as any);
      global._mongoClientPromise = client.connect().catch((err) => {
        // surface clearer error when DNS/SRV lookups fail
        logError('MongoDB connection failed during development:', err instanceof Error ? err.message : err);
        throw err;
      });
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, options as any);
    clientPromise = client.connect().catch((err) => {
      logError('MongoDB connection failed:', err instanceof Error ? err.message : err);
      throw err;
    });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  try {
    const client = await getMongoClientPromise();
    return client.db(dbName);
  } catch (err) {
    // provide helpful guidance for common DNS SRV errors (mongodb+srv)
    const message = err instanceof Error ? err.message : String(err);
    // Log guidance only once to avoid spamming dev logs on repeated client requests
    if (!_mongoGuidanceLogged) {
      _mongoGuidanceLogged = true;
      if (message.toLowerCase().includes('querysrv') || message.toLowerCase().includes('srv')) {
        logError('MongoDB SRV (DNS) lookup failed. If using mongodb+srv://, ensure your environment allows DNS SRV lookups and that the URI is correct.');
      }
      if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
        logError('MongoDB connection refused or host not found. Check MONGODB_URI, network access, and firewall/DNS settings.');
      }
    }
    throw err;
  }
}
