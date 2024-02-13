var admin = require("firebase-admin");

var serviceAccount = require("./kingdomlymaker-ea7a2-firebase-adminsdk-f0jaz-53c3cd04d8.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "kingdomlymaker-ea7a2.appspot.com",
});

class FirebaseClass {
  constructor() {
    this.db = admin.firestore();
    this.auth = admin.auth();
    this.storage = admin.storage();
    this.DATE_NOW = new Date().toLocaleString();
  }

  // Collections
  get projectsCollection() {
    return this.db.collection("projects");
  }

  getProjectDoc(projectId) {
    return this.db.doc(`projects/${projectId}`);
  }

  async getProjectObject(projectId) {
    const docRef = this.getProjectDoc(projectId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data;
    }
    return null;
  }

  async updateMetadata(newMetadata, projectId) {
    const bucketName = "kingdomlymaker-ea7a2.appspot.com"; // Your specific bucket name
    const storage = admin.storage();
    const bucket = storage.bucket(bucketName); // Get the specific bucket

    const metadataPath = `metadatas/${projectId}/metadata.json`;
    const file = bucket.file(metadataPath);
    const jsonMetadata = JSON.stringify(
      newMetadata.sort((a, b) => {
        return parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1]);
      })
    );

    // Convert JSON string to buffer for uploading
    const jsonBuffer = Buffer.from(jsonMetadata, "utf-8");

    try {
      // Upload buffer to Cloud Storage
      await file.save(jsonBuffer, {
        metadata: {
          contentType: "application/json",
        },
      });

      // Get the signed URL for the uploaded file
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-09-2491", // Adjust expiration date as needed
      });

      // Assuming this.db is your initialized Firestore instance
      const projectRef = this.db.collection("projects").doc(projectId);

      await projectRef.update({
        metadata_file: url,
        isGenerating: false,
      });

      console.log("Metadata updated successfully with URL:", url);
      return { url: url, metadata: newMetadata };
    } catch (error) {
      console.error("Failed to upload metadata:", error);
      return null;
    }
  }

  async updateProject(projectId, project) {
    const projectRef = this.getProjectDoc(projectId);
    await projectRef.update(project);
  }

  async updateIsGenerating(projectId, isGenerating) {
    const projectRef = this.getProjectDoc(projectId);
    const docSnap = await projectRef.get();

    if (!docSnap.exists) {
      console.log(`Document with ID ${projectId} does not exist, creating it.`);
      // Optionally create the document or handle this scenario as needed
      await projectRef.set({
        isGenerating: isGenerating === undefined ? false : isGenerating,
      });
    } else {
      // If isGenerating is undefined, explicitly set it to false
      const isGeneratingValue =
        isGenerating === undefined ? false : isGenerating;
      await projectRef.update({ isGenerating: isGeneratingValue });
    }
  }
}

module.exports = FirebaseClass;
