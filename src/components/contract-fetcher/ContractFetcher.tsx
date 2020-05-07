import React, { useEffect, useReducer, useState } from 'react';
import { Dropdown } from "../common/form/Dropdown"
import { AddressInput } from "../common/form/AddressInput"
import { chainOptions } from "../../common/Constants"
import { remixClient } from "../../remix/RemixClient"
import { useDispatchContext, useStateContext } from '../../state/Store'
import { onFetched } from '../../state/actions';
import {Alert, Spinner} from "../common";
import { FetchResult } from '../../state/types';

export type IFetchState = {
    isLoading: boolean,
    error: any,
    chain: any,
    address: string
}

export type IFetchActions = {
    type: 'set_loading' | 'set_error' | 'set_address' | 'set_chain';
    payload?: any
}

export const reducer = (state: IFetchState, action: IFetchActions ) => {
    switch(action.type) {
        case 'set_loading':
            return {
                ...state,
                isLoading: action.payload
            };
        case 'set_error':
            return {
                ...state,
                isLoading: false,
                error: action.payload
            };
        case 'set_address':
            return {
                ...state,
                address: action.payload
            };
        case 'set_chain':
            return {
                ...state,
                chain: action.payload
            };
        default:
            return state;
    }
}

export const ContractFetcher: React.FC = () => {

    const initialState: IFetchState = {
        isLoading: false, 
        chain: chainOptions[0],
        address: '',
        error: null
    }

    const stateContext = useStateContext();
    const dispatchContext = useDispatchContext();

    const [state, dispatch] = useReducer(reducer, initialState)

    const onSubmit = async (e: any) => {
        e.preventDefault();
        dispatch({ type: 'set_loading', payload: true });

        try {
            const response: any = await remixClient.fetch(state.address, state.chain)
            await remixClient.saveFetchedToRemix(response.metadata, response.contract, state.address)
            dispatchContext(onFetched(response));
            dispatch({ type: 'set_loading', payload: false });
        } catch (e) {
            dispatch({ type: 'set_error',  payload: e.toString() });
            dispatch({ type: 'set_loading', payload: false });
        }
    };
    
    return (
        <div className="card m-2">
            <div className="card-body text-center p-3">
                <div className="card-header">
                    <h6 className="card-title m-0">Contract Fetcher</h6>
                </div>
                <p className="card-text my-2 mb-3">Input a valid contract address and load the source code in Remix (Please make sure the correct network is selected)).</p>
                    <form className="d-flex flex-column" onSubmit={onSubmit}>
                        <Dropdown 
                            chainOptions={chainOptions} 
                            chain={state.chain} 
                            setChain={(chain: any) => dispatch({ type: 'set_chain', payload: chain })} />

                        <AddressInput 
                            setAddress={(address: string) => dispatch({ type: 'set_address', payload: address })} 
                        />

                        <button 
                            type="submit" 
                            className="btn btn-primary my-2 mb-0" 
                            disabled={!state.address}>Fetch</button>
                    </form>
                {
                    state.isLoading && <Spinner />
                }
                {
                    state.error && <Alert type={'danger'} heading={state.error}>
                                   </Alert>
                }
                {
                    stateContext.fetchResult && (
                        <Alert type={'success'} heading='Contract successfully fetched!'>
                        </Alert>
                    )
                }
            </div>
        </div>
    )
}
