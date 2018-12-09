const POA_ABI = require('./validator.json');
const Web3 = require('web3');
const sokol = 'https://sokol.poa.network'
const provider = new Web3.providers.HttpProvider(sokol);
const web3 = new Web3(provider);
const poa = new web3.eth.Contract(POA_ABI, '0xFFD6eEBda850E4a20b6d9C9e98Ee631f8d7cA950');


//get a Validators metadata from their mining key
poa.methods.validators("0x23468dB7f4b8Ff4924B0709aB7Ae0971B3Bc8d28").call().then( console.log );

