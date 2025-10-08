// Import the Firebase Admin SDK.
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Get the Firebase service account key from the secret environment variable.
// Vercel will populate process.env.FIREBASE_SERVICE_ACCOUNT with the value you set in the dashboard.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize the Firebase Admin SDK if it hasn't been already.
// This check prevents re-initializing the app on every function invocation.
if (!initializeApp.length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

// This is the main function that Vercel will run.
// It is the default export of the file.
export default async function handler(request, response) {
  // SECURITY CHECK 1: Ensure the request is a POST request.
  // We don't want browsers to be able to navigate to this URL with a GET request.
  if (request.method !== 'POST') {
    // If it's not a POST, send a "Method Not Allowed" error.
    return response.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // Extract the studentId and contactNumber from the request body.
    // Vercel automatically parses the JSON body for you.
    const { studentId, contactNumber } = request.body;

    // SECURITY CHECK 2: Validate that the necessary data was sent.
    if (!studentId || !contactNumber) {
      return response.status(400).json({ success: false, message: 'Student ID and Contact Number are required.' });
    }

    // Get a reference to the Firestore database.
    const db = getFirestore();

    // Create a query to find the student document with the matching student_id.
    const studentsRef = db.collection("students");
    const q = studentsRef.where("student_id", "==", studentId.trim().toUpperCase());
    const querySnapshot = await q.get();

    // Check if the query returned any documents.
    if (querySnapshot.empty) {
      // If no student was found, send a specific error message.
      // We use status 200 because the request itself was valid, even if the login failed.
      return response.status(200).json({ success: false, message: 'Student ID not found.' });
    }

    // Get the data from the first document found.
    const studentDoc = querySnapshot.docs[0];
    const studentData = studentDoc.data();

    // CORE LOGIC: Check if the provided contactNumber matches the parent's or guardian's number.
    if (studentData.contact === contactNumber.trim() || studentData.guardianContact === contactNumber.trim()) {
      // If it's a match, send a success response with the unique document ID for redirection.
      return response.status(200).json({ success: true, docId: studentDoc.id });
    } else {
      // If the numbers don't match, send a failure response.
      return response.status(200).json({ success: false, message: 'Contact number does not match registered details.' });
    }

  } catch (error) {
    // If any other unexpected error occurs, log it for debugging on the server...
    console.error("Internal Server Error:", error);
    // ...and send a generic error message to the user so we don't expose internal details.
    return response.status(500).json({ success: false, message: 'An internal server error occurred. Please try again later.' });
  }
}