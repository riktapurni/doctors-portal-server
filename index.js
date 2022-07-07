const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
const ObjectId = require('mongodb').ObjectId;
// stripe payment 
const stripe = require('stripe')(process.env.STRIPE_SECRET);
// for image 
const fileUpload = require('express-fileupload');
//firebase admin sdk
const admin = require("firebase-admin");
const app = express();

const port = process.env.PORT || 3000;
// firebase service Account key
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
//Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gu8vt.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri);

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

    async function run(){
        try{
        await client.connect();
            console.log('connected to database');
            const database = client.db('doctors_portal');
             const appointmentCollection = database.collection('appointments');
             const userCollection = database.collection('users');
             const doctorCollection = database.collection('doctors');
            //store bokking to the database
             app.post('/appointments', async(req, res)=>{
                 const appointment = req.body;
                 console.log(appointment)
                  const result = await appointmentCollection.insertOne(appointment);
                  console.log(result);
                  res.json(result);
             });
             app.get('/appointments', async(req, res) => {
                 const email = req.query.email;
                 const  date = new Date(req.query.date).toLocaleDateString();
                 console.log(date);
                 query = {email: email, date:date};
                 console.log(query)
                 const cursor = appointmentCollection.find(query)
                 const appointments = await cursor.toArray();
                 res.send(appointments)
             });
             app.get('/appointments/:id', async(req, res)=>{
             const id = req.params.id;
             const query = { _id:ObjectId(id) };
             const result = await appointmentCollection.findOne(query);
             res.json(result);
             });

             //update appointment
             app.put('/appointments/:id', async(req, res) => {
                 const id = req.params.id;
                 const payment = req.body;
                 const filter = {_id:ObjectId(id)};
                 const updateDoc = {
                     $set: {
                         payment: payment
                     }
                 };
                 const result = await appointmentCollection.updateOne(filter, updateDoc);
                 res.json(result);
             })

             // POST Api for users
        app.post('/users', async(req, res)=>{
            const user = req.body;
            const result = await userCollection.insertOne(user);
            // console.log("got new order", newOrder) 
            console.log("added user", result); 
            res.json(result); 
        });
        //google sign in er belai user exit kore kina ta boja jai na.tai upsert use kora hoy.
        app.put('/users', async (req, res) => {
            const user = req.body;
            console.log('put', user);
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });
        //make admin api
        app.put('/users/admin', verifyToken, async(req, res) => {
            const user = req.body;
            // console.log('put', req.headers)
            console.log('put', req.headers.authorization)
            const filter = {email:user.email};
            const updateDoc = { $set: {role:'admin'} };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.json(result);
        });
        //whether an user admin or not /73.6 module
        app.get('/users/:email', async(req, res) => {
        const email = req.params.email;
        const query = { email:email };
        const user = await userCollection.findOne(query);
        let isAdmin = false;
        if(user?.role === 'admin'){
            isAdmin = true;
        }
        res.json({ admin: isAdmin });
        });

        app.post('/create-payment-intent', async(req, res) => {
        const paymentInfo = req.body;
        const amount = paymentInfo.price*100;
        const paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: amount,
            payment_method_types: ['card'],
        }) ;
        res.json({ clientSecret: paymentIntent.client_secret})  
        });
        //add doctor api
        app.post('/doctors', async(req, res) => {
            // console.log('body', req.body);
            // console.log('files', req.files);
            // res.json({success : true})
            const name = req.body.name;
            const email = req.body.email;
            const pic = req.files.image;
            const picData = pic.data;
            const encodedPic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodedPic, 'base64');
            const doctor = {
                name,
                email,
                image: imageBuffer
            }
            const result = await doctorCollection.insertOne(doctor);
            res.json(result);
            
        });
        app.get('/doctors', async(req, res) => {
        const cursor = doctorCollection.find({});
        const doctors = await cursor.toArray();
        res.json(doctors);
        });
        }//try end
        finally{
            // await client.close();
        }
    }//function end
run().catch(console.dir);
app.get('/', (req, res)=>{
    res.send('Running react app server');
});
app.listen ((process.env.PORT || 3000), ()=>{
    console.log("Running server on port", port)
})