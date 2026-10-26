import type {CapacitorConfig} from '@capacitor/cli';
// Internal beta identity. Confirm ownership/name before the FIRST Play upload:
// package IDs cannot be changed for an existing store listing.
const config:CapacitorConfig={
 appId:'app.pordondepasa.pasajero',appName:'PorDóndePasa',webDir:'dist',
 server:{hostname:'localhost',androidScheme:'https',cleartext:false},
 android:{allowMixedContent:false},
};
export default config;
