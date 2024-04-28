import { createReadStream } from "fs";

function CSVStreamReader( args ) {
    let readStream = createReadStream( args.filePath, {
        encoding: "utf-8",
        highWaterMark: args.chunkSize
    } );

    return new Promise( ( resolve ) => {
        let result = [];
        let remainder = "";

        readStream.on( "data", chunk => {
            let splitByLine = chunk.split( '\n' );
            splitByLine.forEach( ( x, idx ) => {
                if ( x.length === 0 ) {
                    if ( remainder !== "" ) {
                        result.push( remainder.split( ',' ).reduce( ( acc, r, idx2 ) => {
                            return args.transformer( acc, r, idx2 );
                        }, {} ) );
                    }
                    return;
                }

                if ( remainder !== "" && idx === 0 ) {
                    x = remainder + x;
                }

                if ( idx === splitByLine.length - 1 && chunk.substr( -1, 1 ) !== '\r' ) {
                    remainder = x;
                } else {
                    remainder = "";

                    result.push( x.split( ',' ).reduce( ( acc, r, idx2 ) => {
                        return args.transformer( acc, r, idx2 );
                    }, {} ) );
                }

            } );
        } );

        readStream.on( "end", () => {
            resolve( result );
        } );
    } );
}

export default CSVStreamReader;