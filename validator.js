const POA_ABI = require('./validator.json');
const Web3 = require('web3');
const sokol = 'https://sokol.poa.network'
const provider = new Web3.providers.HttpProvider(sokol);
const web3 = new Web3(provider);
const poa = new web3.eth.Contract(POA_ABI, '0x1ce9ad5614d3e00b88affdfa64e65e52f2e4e0f4');


//get a Validators metadata from their mining key
poa.methods.validators("0x23468dB7f4b8Ff4924B0709aB7Ae0971B3Bc8d28").call().then( console.log );

