import sys
import os
import logging
from random import randint
from pathlib import Path

CONFIG_FILE = ".config"

DNS_NODES = [
    "seed.bitcoin.sipa.be",
    "dnsseed.bluematt.me",
    "dnsseed.bitcoin.dashjr.org",
    "seed.bitcoinstats.com",
    "seed.bitcoin.jonasschnelli.ch",
    "seed.btc.petertodd.org"
]

ALLOWED_ARG_TYPES = [
    "--host",
    "--port",
    "--log",
    "--tor",
    "--dist",
    "-h",
    "-p",
    "-l",
    "-t",
    "-d"
]

ARG_VAL_REQUIRED = [
    "--host",
    "--port",
    "--log",
    "-h",
    "-p",
    "-l"
]

ARG_PAIRS = [
    (("--host", "-h"), "host"),
    (("--port", "-p"), "port"),
    (("--log", "-l"), "log"),
    (("--tor", "-t"), "tor"),
    (("--dist", "-d"), "dist")
]

ARG_VAL_NOT_REQUIRED = [
    "--tor",
    "-t",
    "--dist",
    "-d"
]

ARG_VAL_NUMERIC = [
    "--port",
    "-p",
    "port"
]

ARG_VAL_LOG = [
    "--log",
    "-l",
    "log"
]

ARG_VAL_TYPE_LOG = [
    "INFO",
    "DEBUG"
]

ARG_VAL_TYPE_DEFAULT = "INFO"

def usage():
    print("Usage Options:")
    print("")
    print("python3 {} --host=<host> --port=<port> --tor[OPTIONAL] --log=<INFO/DEBUG>".format(sys.argv[0]))
    print("python3 {} -h=<host> -p=<port> -t[OPTIONAL] -l=<INFO/DEBUG>".format(sys.argv[0]))
    print("")
    sys.exit(0)

def is_dist_mode():
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg == "--dist" or arg == "-d":
                return True
                break
    return False

def check_folder(dist_mode=False):
    if dist_mode:
        if sys.platform == "darwin" or sys.platform == "linux":
            folder_path = os.path.join(str(Path.home()), ".bitcoin-explorer-app")
        elif sys.platform == "win32":
            folder_path = os.path.join(str(Path.home()), "bitcoin-explorer-app")
        else:
            folder_path = os.path.join(str(Path.home()), "bitcoin-explorer-app")
    else:
        folder_path = sys.path[0]
    if not os.path.exists(folder_path):
        os.mkdir(folder_path, 0o744)
    return folder_path


def check_config_file(dist_mode=False):
    path = check_folder(dist_mode)
    if os.path.exists(os.path.join(path, CONFIG_FILE)):
        with open(os.path.join(path, CONFIG_FILE), "r") as f:
            try:
                config_vars = []
                for line in f.readlines():
                    config_vars.append("--" + line.split("\n")[0])
                return config_vars
            except:
                logging.critical("[*] Unable to read .config file. Ignoring")
                return False
    return False

def save_config_file(valid_args, dist_mode=False):
    path = check_folder(dist_mode)
    with open(os.path.join(path, CONFIG_FILE), "w") as f:
        try:
            f.write("host=" + valid_args["host"] + "\n")
            f.write("port=" + str(valid_args["port"]) + "\n")
            f.write("log=" + valid_args["log"] + "\n")
            if valid_args["tor"]:
                f.write("tor")
        except:
            logging.critical("[*] Unable to write .config file.")

def check_argv():

    dist_mode = False
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg == "--dist" or arg == "-d":
                dist_mode = True
                break

    config_file_args = check_config_file(dist_mode=dist_mode)
    if config_file_args:
        args = config_file_args
        if dist_mode:
            args.append("--dist")
        config_file = True
    else:
        args = sys.argv
        config_file = False
    args_dict = {}
    for i, arg in enumerate(args):
        if i == 0 and not config_file:
            continue
        split_args = arg.split("=")
        if split_args[0]:
            if len(split_args) == 2:
                if split_args[0] not in args_dict.keys():
                    args_dict[split_args[0]] = split_args[1]
            elif len(split_args) == 1:
                args_dict[split_args[0]] = None
            else:
                usage()
        else:
            usage()
    allowed_keys = list(filter(lambda key: key in ALLOWED_ARG_TYPES, args_dict.keys()))
    valid_args_keys = {}
    for key in allowed_keys:
        valid_args_keys[key] = args_dict[key]
    valid_args_val = {}
    for key in valid_args_keys:
        pair_match = list(filter(lambda pair: key in pair[0], ARG_PAIRS))[0]
        pair_common_key = pair_match[1]
        if key in ARG_VAL_REQUIRED and valid_args_keys[key]:
            if pair_common_key in valid_args_val.keys():
                continue
            valid_args_val[pair_common_key] = valid_args_keys[key]
        elif key in ARG_VAL_NOT_REQUIRED and not valid_args_keys[key]:
            valid_args_val[pair_common_key] = True
        else:
            usage()
    valid_args = {}
    for key in valid_args_val:
        if key in ARG_VAL_NUMERIC:
            if valid_args_val[key].isnumeric():
                valid_args[key] = int(valid_args_val[key])
            else:
                usage()
        elif key in ARG_VAL_LOG:
            if valid_args_val[key] not in ARG_VAL_TYPE_LOG:
                valid_args[key] = ARG_VAL_TYPE_DEFAULT
            else:
                valid_args[key] = valid_args_val[key]
        else:
            valid_args[key] = valid_args_val[key]

    valid_keys = valid_args.keys()
    if "host" not in valid_keys:
        valid_args["host"] = DNS_NODES[randint(0, len(DNS_NODES)-1)]
        valid_args["port"] = 8333
    if "port" not in valid_keys:
        valid_args["port"] = 8333
    if "log" not in valid_keys:
        valid_args["log"] = "INFO"
    if "tor" not in valid_keys:
        valid_args["tor"] = False
    if "dist" not in valid_keys:
        valid_args["dist"] = False

    host = valid_args["host"]
    port = valid_args["port"]
    log = valid_args["log"]
    tor = valid_args["tor"]
    dist = valid_args["dist"]

    save_config_file(valid_args, dist_mode=valid_args["dist"])
    return host, port, log, tor, dist
