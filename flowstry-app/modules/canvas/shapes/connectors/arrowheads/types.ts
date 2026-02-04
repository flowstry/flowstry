export type ArrowheadType = 
    | 'none'                    // Association (Plain Relationship) - No arrowhead
    | 'open-arrow'              // Directed Association - Open arrow (hollow triangle)
    | 'filled-triangle'         // Solid arrow
    | 'hollow-triangle'         // Inheritance/Generalization - Hollow triangle
    | 'hollow-diamond'          // Aggregation - Hollow diamond at whole class
    | 'filled-diamond'          // Composition - Filled diamond at whole class
    | 'circle'                  // Interface/Socket
    | 'filled-circle'           // Interface/Ball
    | 'bar'                     // End of line
    | 'half-arrow-top'          // Async message
    | 'half-arrow-bottom'       // Async message
    | 'crows-foot-one'          // ERD: Mandatory One
    | 'crows-foot-many'         // ERD: Mandatory Many
    | 'crows-foot-zero-one'     // ERD: Optional One
    | 'crows-foot-zero-many'    // ERD: Optional Many
    | 'crows-foot-one-many'     // ERD: Mandatory Many (One or Many)
