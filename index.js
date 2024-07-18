const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 8000
const corsOptions = {
    origin: [
      'http://localhost:5173', 
      'http://localhost:5174',
      

    ],
    credentials: true,
    optionSuccessStatus: 200,
  }
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  };
  app.use(cors(corsOptions)) 
  app.use(express.json())
  app.use(cookieParser())
  // Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    // console.log(token)
    if (!token) {
      return res.status(401).send({ message: 'unauthorized access 39', })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err)
        return res.status(401).send({ message: 'unauthorized access 44' })
      }
      req.user = decoded
      next()
    })
  }
  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zumttn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
 
async function run (){
    try{
        const db = client.db('moneyGives');
        const registerCollection = db.collection('users')
        const registerAgentCollection = db.collection('agent')
        const verifyAdmin = async (req, res, next) => {
            // console.log('hello')
            const user = req.user
            const query = { email: user?.email }
            const result = await registerCollection.findOne(query)
            // console.log(result?.role)
            if (!result || result?.role !== 'Admin')
              return res.status(401).send({ message: 'unauthorized access!!' })
        
            next()
          }
              // verify agent middleware
              const verifyAgent = async (req, res, next) => {
                
                const user = req.user
                const query = { email: user?.email }
                const result = await registerCollection.findOne(query)
                console.log(result?.role)
                if (!result || result?.role !== 'Agent') {
                  return res.status(401).send({ message: 'unauthorized access!!' })
                }
          
                next()
              }
               // jwt generate
           app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
              expiresIn: '365d',
            })
            res
              .cookie('token', token,  {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
              })
              .send({ success: true })
          })
                 // clere cookis
                 app.post('/logout', async (req, res) => {
                    const user = req.body;
                    console.log('logging out', user, "ami achi");
                    res.clearCookie('token', {...cookieOptions,  maxAge: 0 }).send({ success: true })
                })
                // register in db
           app.put('/register', async(req, res)=>{
            const user = req.body
  
            const query = { email: user?.email }
            // check if user already exists in db
            const isExist = await registerCollection.findOne(query)
            if (isExist) {
              if (user.status === 'pending') {
                // if existing user try to change his role
                const result = await registerCollection.updateOne(query, {
                  $set: { status: user?.status },
                })
                return res.send(result)
              } else {
                // if existing user login again
                return res.send(isExist)
              }
            }
            // save user for the first time
            const options = { upsert: true }
           
            const hashPass = await bcrypt.hash(user.pin, 13)
            // console.log(hashPass)
            const updateDoc = {
              $set: {
                email: user.email,
                role: user.role,
                status: user.status,
                mobile: user.mobile,
                pin: hashPass,
                name:user.name
              },
            }
            const result = await registerCollection.updateOne(query, updateDoc, options)
            
            res.send(result)
           }) 
                // register Agent in db
           app.put('/register/agent', async(req, res)=>{
            const user = req.body
  
            const query = { email: user?.email }
            // check if user already exists in db
            const isExist = await registerAgentCollection.findOne(query)
            if (isExist) {
              if (user.status === 'pending') {
                // if existing user try to change his role
                const result = await registerAgentCollection.updateOne(query, {
                  $set: { status: user?.status },
                })
                return res.send(result)
              } else {
                // if existing user login again
                return res.send(isExist)
              }
            }
            // save user for the first time
            const options = { upsert: true }
           const getPass = await registerCollection.findOne({email:user.email})
           const isValid = await bcrypt.compare(user.pin, getPass?.pin||"")
        if (!isValid) {
            res.send({message: "Unauthorized"})
            return
        } 
          //  console.log(isValid)
            const hashPass = await bcrypt.hash(user.pin, 13)
            // console.log(hashPass)
            const updateDoc = {
              $set: {
                email: user.email,
                role: user.role,
                status: user.status,
                mobile: user.mobile,
                pin: hashPass,
                name:user.name
              },
            }
            const result = await registerAgentCollection.updateOne(query, updateDoc, options)
            
            res.send(result)
           }) 

              //update a user role
    app.put('/users/update/:email', verifyToken, async (req, res) => {
        const email = req.params.email
        const data = req.body
        const query = { email }
        // console.log(data)
        const updateDoc = {
          $set: { ...data,},
        }
        const updateAgent = {
          $set:{status: data.status,
                role:"Agent"
          }
        }
        if (data.status == "Approve" && data.balance == 10000) {
          const resultAgent = await registerAgentCollection.updateOne(query, updateAgent)
          const resultUser = await registerCollection.updateOne(query, {$set:{role:"Agent",
            balance:data.balance
          }})
          return
        }
        
       
        const result = await registerCollection.updateOne(query, updateDoc)
        res.send(result)
        
      })
             // get all users data from db
       app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
        const search = req.query.search || '';
        const query = {
            name:{$regex:String(search), $options: 'i'},
          }
        const result = await registerCollection.find(query).toArray()
        res.send(result)
      })
             // get all users data from db
       app.get('/users/agent', verifyToken, verifyAdmin, async (req, res) => {
        const search = req.query.search || '';
        const query = {
            name:{$regex:String(search), $options: 'i'},
          }
        const result = await registerAgentCollection.find(query).toArray()
        res.send(result)
      })
             // login user
       app.put('/login',  async (req, res) => {
        const data = req.body;
        const query = {
            
             mobile:data.emailOrPh
        }
        const findPhone = await registerCollection.findOne(query)
        const isValid = await bcrypt.compare(data.password, findPhone.pin)
        if (isValid) {
            res.send(findPhone)
        } 
      })
    //   get singal user 
    app.get('/user/:email', verifyToken,  async (req, res) => {
        const email = req.params.email;
        
        const result = await registerCollection.findOne({email})
        res.send(result)
      })
           
           console.log("Pinged your deployment. You successfully connected to MongoDB!", );
    }
 finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('Hello from money Server..')
  })
  
app.listen(port, () => {
    console.log(`Brainstrom is running on port ${port}`)
  })