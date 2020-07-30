# Bitcoin Explorer App

The Bitcoin Explorer app is an electron application with a python backend. The app connects with a bitcoin node directly or via tor and downloads and indexes the blockchain into a queryable MongoDB database. Within the app, you have the ability to search for blocks, transactions and addresses. The app will spawn individual background processes for syncing, rpc and tor services. The app is more of an experiment to further my knowledge in Bitcoin.

![Alt text](/Docs/screenshot_home.png?raw=true "Home")

![Alt text](/Docs/screenshot_config.png?raw=true "Config")

**Blocks:**
You can search with block height or block hash (hex). The app will fetch and display the block information. In the background, the app will fetch supporting information such as transaction input amounts and update the total block fee amount.

![Alt text](/Docs/screenshot_block.png?raw=true "Block")

**Transactions:**
You can search with transaction hash (hex). The app will fetch the supporting transaction input amounts for the transaction after the initial load.

![Alt text](/Docs/screenshot_tx.png?raw=true "Transaction")

**Addresses:**
You can search for the following address types:
* P2PK: Compressed and uncompressed public keys (hex). They start with 02, 03, or 04.
* P2PKH: Base58 encoded addresses that start with 1.
* P2SH/ P2SH-P2WPKH/ P2SH-P2WPSH: Base58 encoded addresses that start with 3.
* Native P2PWPKH/ Native P2WPSH: Bech32 addresses that start with bc.

Once the data is loaded, the app will fetch supporting information such as transaction input amounts and transaction outputs spending status to be able to calculate the pending balance. Spent and received transactions for the address will be displayed in reverse chronological order.

*It should be possible to search for the 20 or 32 bytes address hash as well.*
*Unfortunately, address balance calculation can consume some time especially if there are a large number of transaction outputs associated with the address.*

### Prerequisites

There is a packaged MacOS app available for download [here](https://gofile.io/d/KyXTrl). However, if building the application, you will need the following:

**MongoDB**
The app uses MongoDB as the database backend. You will need to download mongod binary executable for your operating system:
[MongoDB](https://www.mongodb.com/download-center/community)

**Tor (Optional and Experimental)**
Tor is free and open-source software for enabling anonymous communication. If you would like to connect to your bitcoin node using tor. You will need to have tor installed for your operating system:
[Tor Project](https://2019.www.torproject.org/docs/tor-doc-osx.html.en)

*Tor support is experimental and connectivity issues may be encountered*

## Build the application

There is a packaged MacOS app available for download [here](https://gofile.io/d/KyXTrl)

To build for your operating system, please follow the instructions below:

**Download the respository**
```
git clone https://github.com/ismailakkila/bitcoin-explorer-app.git
```

**Move supporting binary executables**
MongoDB: You will need to move the required ```mongod```or ```mongod.exe``` file to ```bitcoin-explorer-app/electron/backend```
Tor (Optional): If tor is installed on your operating system, the app will attempt to use it. Otherwise, you will need to move the required ```tor``` or ```tor.exe``` file to ```bitcoin-explorer-app/electron/backend```.

**Install python dependencies and create python executables**
```
python3 -m venv bitcoin-explorer-app
cd bitcoin-explorer-app
source bin/activate
python -m pip install -r requirements.txt
python -m PyInstaller --onefile rpc_interface.py
python -m PyInstaller --onefile main.py
deactivate
mv dist/rpc_interface electron/backend
mv dist/main electron/backend
chmod -R +x electron/backend/
```

**Install npm dependencies**
```
cd electron && npm install
```

**Build the application with electron builder**
```
npm run dist
```
The app should be available at ```electron/dist```

**Create .config file (OPTIONAL)**
You can choose to create a custom config file to connect to your own bitcoin node for initial block download and sync. Otherwise, the app will attempt to connect to a random node from the below list:

* seed.bitcoin.sipa.be
* dnsseed.bluematt.me
* dnsseed.bitcoin.dashjr.org
* seed.bitcoinstats.com
* seed.bitcoin.jonasschnelli.ch
* seed.btc.petertodd.org

You can also change these parameters in the app.

Default Paths to ```.config``` file:
Linux and MacOS: ```~/.bitcoin-explorer-app/.config```
Windows: ```<home_user_directory>/bitcoin-explorer-app/.config```

Examples:

  Without Tor:
  ```
  host=<host_or_ip_address>
  port=8333
  log=INFO
  ```

  with Tor:
  ```
  host=<host_or_ip_address>
  port=8333
  log=INFO
  tor
  ```

**Database and Log files**

Default Paths:
Linux and MacOS: ```~/.bitcoin-explorer-app/```
Windows: ```<home_user_directory>/bitcoin-explorer-app/```

## Built With

* [MongoDB](https://www.mongodb.com) - The web framework used
* [Zerorpc](https://www.zerorpc.io) - Dependency Management
* [Electron](https://www.electronjs.org) - Desktop app frontend and packager
* [React](https://reactjs.org) - Javascript framework for the UI
* [Redux](https://redux.js.org) - Javascript framework for app state

## Known Issues

* Tor connectivity can sometimes freeze pausing the syncing processes
* Performance issues especially during sync

## Acknowledgments and Resources

* [Programming Bitcoin](https://programmingbitcoin.com) by [Jimmy Song](https://github.com/jimmysong/programmingbitcoin)
