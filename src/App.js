import express from 'express';
import bodyParser from 'body-parser';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import dotenv from 'dotenv';
import cors from 'cors';

// Load env config 
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000; // load port from .env or default to 3000

// Middleware to parse JSON bodies
app.use(bodyParser.json());

//CORS - Security - Isolate endpoint
// CORS configuration for specific origins
const corsOptions = {
    origin: 'https://chatbot-vite-template.onrender.com', // or an array of origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization']
  };

// Use CORS middleware to enable cross-origin requests
app.use(cors(corsOptions));

//END CORS - Security

// POST route to accept input
app.post('/CreateScripter', cors(corsOptions), async (req, res) => {
    const inputText = req.body.input; // Access the input from the request body

    // Loads documents from knowledge folder
    const loader = new DirectoryLoader("Knowlegde", { ".txt": (path) => new TextLoader(path) });
    const docs = await loader.load();

    //Splits documents
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const splits = await textSplitter.splitDocuments(docs);

    //Transforms splits to embeddings and stores on vectorStore
    const vectorStore = await MemoryVectorStore.fromDocuments(splits, new OpenAIEmbeddings());
    const retriever = vectorStore.asRetriever();

    //Create query for models 
    const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0125", temperature: 0 });   //Replace model for the fine-tuned version
    const prompt = ChatPromptTemplate.fromTemplate(`
        Answer the following question based only on the provided context:
        <context>{context}</context>
        You should answer the code question giving an example to the user, use concise responses dont invent stuff.
        The format of your response is:
        Consice short explanation, no line breaks.
        <code>Code example</code>
        If the question is not related to QuestionProJs logics, kindly remind the user that you can help only on QuestionPro Javascript logics questions at the moment & invite the user to our help center: https://www.questionpro.com/help/ (dont use the same text always to this, create a short invitation) "
        Question: {input}`);

    //RAG    
    const documentChain = await createStuffDocumentsChain({ llm, prompt });
    const retrievalChain = await createRetrievalChain({ combineDocsChain: documentChain, retriever });

    // Invoke the chain with the input from the POST request
    const result = await retrievalChain.invoke({ input: inputText });
    
    // Respond with the result
    res.json({ answer: result.answer });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Export the app instance as a default export
export default app;
