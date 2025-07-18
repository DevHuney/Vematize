import { MongoClient } from 'mongodb'

let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('CRITICAL_WARNING: Missing environment variable: "MONGODB_URI"');
  console.error('The application will not be able to connect to the database.');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  
  clientPromise = Promise.reject(new Error('Missing environment variable: "MONGODB_URI"'));

} else {
    const uri = process.env.MONGODB_URI
    const options = {}

    let client: MongoClient;

    if (process.env.NODE_ENV === 'development') {
      let globalWithMongo = global as typeof global & {
        _mongoClientPromise?: Promise<MongoClient>
      }

      if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options)
        globalWithMongo._mongoClientPromise = client.connect()
      }
      clientPromise = globalWithMongo._mongoClientPromise
    } else {
      client = new MongoClient(uri, options)
      clientPromise = client.connect()
    }
}

export default clientPromise
