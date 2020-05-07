import React, { useState } from "react";
import { Dropdown } from "./Dropdown";
import { AddressInput } from "./AddressInput";
import { remixClient } from "../../../remix/RemixClient";
import { chainOptions } from "../../../common/Constants"

export const ContractForm = ({ setLoading, setError, setChainValue }) => {

    const [chain, setChain] = useState(chainOptions[0]);
    const [address, setAddress] = useState('');
    const [files, setFiles] = useState([]);
    const [isListening, setListening] = useState(false);

   
    const resetState = () => {
        setError(null);
        setChainValue(null);
    };


};
