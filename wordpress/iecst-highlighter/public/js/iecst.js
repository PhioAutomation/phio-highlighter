/*!
 * IEC Structured Text Highlighter v1.0.0
 * Copyright (c) 2025 Andrew Parman
 * Released under the MIT License https://highlighter.phioautomation.com/LICENSE.txt
 */
( function () {
	'use strict';
	const DefaultBufferLength = 1024;
	let nextPropID = 0;
	class Range {
		constructor( from, to ) {
			this.from = from;
			this.to = to;
		}
	}
	class NodeProp {
		/**
    Create a new node prop type.
    */
		constructor( config = {} ) {
			this.id = nextPropID++;
			this.perNode = !! config.perNode;
			this.deserialize =
				config.deserialize ||
				( () => {
					throw new Error(
						"This node type doesn't define a deserialize function"
					);
				} );
		}
		/**
    This is meant to be used with
    [`NodeSet.extend`](#common.NodeSet.extend) or
    [`LRParser.configure`](#lr.ParserConfig.props) to compute
    prop values for each node type in the set. Takes a [match
    object](#common.NodeType^match) or function that returns undefined
    if the node type doesn't get this prop, and the prop's value if
    it does.
    */
		add( match ) {
			if ( this.perNode )
				throw new RangeError(
					"Can't add per-node props to node types"
				);
			if ( typeof match != 'function' ) match = NodeType.match( match );
			return ( type ) => {
				let result = match( type );
				return result === void 0 ? null : [ this, result ];
			};
		}
	}
	NodeProp.closedBy = new NodeProp( {
		deserialize: ( str ) => str.split( ' ' ),
	} );
	NodeProp.openedBy = new NodeProp( {
		deserialize: ( str ) => str.split( ' ' ),
	} );
	NodeProp.group = new NodeProp( {
		deserialize: ( str ) => str.split( ' ' ),
	} );
	NodeProp.isolate = new NodeProp( {
		deserialize: ( value ) => {
			if ( value && value != 'rtl' && value != 'ltr' && value != 'auto' )
				throw new RangeError( 'Invalid value for isolate: ' + value );
			return value || 'auto';
		},
	} );
	NodeProp.contextHash = new NodeProp( { perNode: true } );
	NodeProp.lookAhead = new NodeProp( { perNode: true } );
	NodeProp.mounted = new NodeProp( { perNode: true } );
	class MountedTree {
		constructor( tree, overlay, parser2 ) {
			this.tree = tree;
			this.overlay = overlay;
			this.parser = parser2;
		}
		/**
    @internal
    */
		static get( tree ) {
			return tree && tree.props && tree.props[ NodeProp.mounted.id ];
		}
	}
	const noProps = /* @__PURE__ */ Object.create( null );
	class NodeType {
		/**
    @internal
    */
		constructor( name2, props, id, flags = 0 ) {
			this.name = name2;
			this.props = props;
			this.id = id;
			this.flags = flags;
		}
		/**
    Define a node type.
    */
		static define( spec ) {
			let props =
				spec.props && spec.props.length
					? /* @__PURE__ */ Object.create( null )
					: noProps;
			let flags =
				( spec.top ? 1 : 0 ) |
				( spec.skipped ? 2 : 0 ) |
				( spec.error ? 4 : 0 ) |
				( spec.name == null ? 8 : 0 );
			let type = new NodeType( spec.name || '', props, spec.id, flags );
			if ( spec.props )
				for ( let src of spec.props ) {
					if ( ! Array.isArray( src ) ) src = src( type );
					if ( src ) {
						if ( src[ 0 ].perNode )
							throw new RangeError(
								"Can't store a per-node prop on a node type"
							);
						props[ src[ 0 ].id ] = src[ 1 ];
					}
				}
			return type;
		}
		/**
    Retrieves a node prop for this type. Will return `undefined` if
    the prop isn't present on this node.
    */
		prop( prop ) {
			return this.props[ prop.id ];
		}
		/**
    True when this is the top node of a grammar.
    */
		get isTop() {
			return ( this.flags & 1 ) > 0;
		}
		/**
    True when this node is produced by a skip rule.
    */
		get isSkipped() {
			return ( this.flags & 2 ) > 0;
		}
		/**
    Indicates whether this is an error node.
    */
		get isError() {
			return ( this.flags & 4 ) > 0;
		}
		/**
    When true, this node type doesn't correspond to a user-declared
    named node, for example because it is used to cache repetition.
    */
		get isAnonymous() {
			return ( this.flags & 8 ) > 0;
		}
		/**
    Returns true when this node's name or one of its
    [groups](#common.NodeProp^group) matches the given string.
    */
		is( name2 ) {
			if ( typeof name2 == 'string' ) {
				if ( this.name == name2 ) return true;
				let group = this.prop( NodeProp.group );
				return group ? group.indexOf( name2 ) > -1 : false;
			}
			return this.id == name2;
		}
		/**
    Create a function from node types to arbitrary values by
    specifying an object whose property names are node or
    [group](#common.NodeProp^group) names. Often useful with
    [`NodeProp.add`](#common.NodeProp.add). You can put multiple
    names, separated by spaces, in a single property name to map
    multiple node names to a single value.
    */
		static match( map ) {
			let direct = /* @__PURE__ */ Object.create( null );
			for ( let prop in map )
				for ( let name2 of prop.split( ' ' ) )
					direct[ name2 ] = map[ prop ];
			return ( node ) => {
				for (
					let groups = node.prop( NodeProp.group ), i = -1;
					i < ( groups ? groups.length : 0 );
					i++
				) {
					let found = direct[ i < 0 ? node.name : groups[ i ] ];
					if ( found ) return found;
				}
			};
		}
	}
	NodeType.none = new NodeType(
		'',
		/* @__PURE__ */ Object.create( null ),
		0,
		8
		/* NodeFlag.Anonymous */
	);
	class NodeSet {
		/**
    Create a set with the given types. The `id` property of each
    type should correspond to its position within the array.
    */
		constructor( types ) {
			this.types = types;
			for ( let i = 0; i < types.length; i++ )
				if ( types[ i ].id != i )
					throw new RangeError(
						'Node type ids should correspond to array positions when creating a node set'
					);
		}
		/**
    Create a copy of this set with some node properties added. The
    arguments to this method can be created with
    [`NodeProp.add`](#common.NodeProp.add).
    */
		extend( ...props ) {
			let newTypes = [];
			for ( let type of this.types ) {
				let newProps = null;
				for ( let source of props ) {
					let add = source( type );
					if ( add ) {
						if ( ! newProps )
							newProps = Object.assign( {}, type.props );
						newProps[ add[ 0 ].id ] = add[ 1 ];
					}
				}
				newTypes.push(
					newProps
						? new NodeType(
								type.name,
								newProps,
								type.id,
								type.flags
						  )
						: type
				);
			}
			return new NodeSet( newTypes );
		}
	}
	const CachedNode = /* @__PURE__ */ new WeakMap(),
		CachedInnerNode = /* @__PURE__ */ new WeakMap();
	var IterMode;
	( function ( IterMode2 ) {
		IterMode2[ ( IterMode2[ 'ExcludeBuffers' ] = 1 ) ] = 'ExcludeBuffers';
		IterMode2[ ( IterMode2[ 'IncludeAnonymous' ] = 2 ) ] =
			'IncludeAnonymous';
		IterMode2[ ( IterMode2[ 'IgnoreMounts' ] = 4 ) ] = 'IgnoreMounts';
		IterMode2[ ( IterMode2[ 'IgnoreOverlays' ] = 8 ) ] = 'IgnoreOverlays';
	} )( IterMode || ( IterMode = {} ) );
	class Tree {
		/**
    Construct a new tree. See also [`Tree.build`](#common.Tree^build).
    */
		constructor( type, children, positions, length, props ) {
			this.type = type;
			this.children = children;
			this.positions = positions;
			this.length = length;
			this.props = null;
			if ( props && props.length ) {
				this.props = /* @__PURE__ */ Object.create( null );
				for ( let [ prop, value ] of props )
					this.props[ typeof prop == 'number' ? prop : prop.id ] =
						value;
			}
		}
		/**
    @internal
    */
		toString() {
			let mounted = MountedTree.get( this );
			if ( mounted && ! mounted.overlay ) return mounted.tree.toString();
			let children = '';
			for ( let ch of this.children ) {
				let str = ch.toString();
				if ( str ) {
					if ( children ) children += ',';
					children += str;
				}
			}
			return ! this.type.name
				? children
				: ( /\W/.test( this.type.name ) && ! this.type.isError
						? JSON.stringify( this.type.name )
						: this.type.name ) +
						( children.length ? '(' + children + ')' : '' );
		}
		/**
    Get a [tree cursor](#common.TreeCursor) positioned at the top of
    the tree. Mode can be used to [control](#common.IterMode) which
    nodes the cursor visits.
    */
		cursor( mode = 0 ) {
			return new TreeCursor( this.topNode, mode );
		}
		/**
    Get a [tree cursor](#common.TreeCursor) pointing into this tree
    at the given position and side (see
    [`moveTo`](#common.TreeCursor.moveTo).
    */
		cursorAt( pos, side = 0, mode = 0 ) {
			let scope = CachedNode.get( this ) || this.topNode;
			let cursor = new TreeCursor( scope );
			cursor.moveTo( pos, side );
			CachedNode.set( this, cursor._tree );
			return cursor;
		}
		/**
    Get a [syntax node](#common.SyntaxNode) object for the top of the
    tree.
    */
		get topNode() {
			return new TreeNode( this, 0, 0, null );
		}
		/**
    Get the [syntax node](#common.SyntaxNode) at the given position.
    If `side` is -1, this will move into nodes that end at the
    position. If 1, it'll move into nodes that start at the
    position. With 0, it'll only enter nodes that cover the position
    from both sides.
    
    Note that this will not enter
    [overlays](#common.MountedTree.overlay), and you often want
    [`resolveInner`](#common.Tree.resolveInner) instead.
    */
		resolve( pos, side = 0 ) {
			let node = resolveNode(
				CachedNode.get( this ) || this.topNode,
				pos,
				side,
				false
			);
			CachedNode.set( this, node );
			return node;
		}
		/**
    Like [`resolve`](#common.Tree.resolve), but will enter
    [overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
    pointing into the innermost overlaid tree at the given position
    (with parent links going through all parent structure, including
    the host trees).
    */
		resolveInner( pos, side = 0 ) {
			let node = resolveNode(
				CachedInnerNode.get( this ) || this.topNode,
				pos,
				side,
				true
			);
			CachedInnerNode.set( this, node );
			return node;
		}
		/**
    In some situations, it can be useful to iterate through all
    nodes around a position, including those in overlays that don't
    directly cover the position. This method gives you an iterator
    that will produce all nodes, from small to big, around the given
    position.
    */
		resolveStack( pos, side = 0 ) {
			return stackIterator( this, pos, side );
		}
		/**
    Iterate over the tree and its children, calling `enter` for any
    node that touches the `from`/`to` region (if given) before
    running over such a node's children, and `leave` (if given) when
    leaving the node. When `enter` returns `false`, that node will
    not have its children iterated over (or `leave` called).
    */
		iterate( spec ) {
			let { enter, leave, from = 0, to = this.length } = spec;
			let mode = spec.mode || 0,
				anon = ( mode & IterMode.IncludeAnonymous ) > 0;
			for (
				let c = this.cursor( mode | IterMode.IncludeAnonymous );
				;

			) {
				let entered = false;
				if (
					c.from <= to &&
					c.to >= from &&
					( ( ! anon && c.type.isAnonymous ) || enter( c ) !== false )
				) {
					if ( c.firstChild() ) continue;
					entered = true;
				}
				for (;;) {
					if ( entered && leave && ( anon || ! c.type.isAnonymous ) )
						leave( c );
					if ( c.nextSibling() ) break;
					if ( ! c.parent() ) return;
					entered = true;
				}
			}
		}
		/**
    Get the value of the given [node prop](#common.NodeProp) for this
    node. Works with both per-node and per-type props.
    */
		prop( prop ) {
			return ! prop.perNode
				? this.type.prop( prop )
				: this.props
				? this.props[ prop.id ]
				: void 0;
		}
		/**
    Returns the node's [per-node props](#common.NodeProp.perNode) in a
    format that can be passed to the [`Tree`](#common.Tree)
    constructor.
    */
		get propValues() {
			let result = [];
			if ( this.props )
				for ( let id in this.props )
					result.push( [ +id, this.props[ id ] ] );
			return result;
		}
		/**
    Balance the direct children of this tree, producing a copy of
    which may have children grouped into subtrees with type
    [`NodeType.none`](#common.NodeType^none).
    */
		balance( config = {} ) {
			return this.children.length <= 8
				? this
				: balanceRange(
						NodeType.none,
						this.children,
						this.positions,
						0,
						this.children.length,
						0,
						this.length,
						( children, positions, length ) =>
							new Tree(
								this.type,
								children,
								positions,
								length,
								this.propValues
							),
						config.makeTree ||
							( ( children, positions, length ) =>
								new Tree(
									NodeType.none,
									children,
									positions,
									length
								) )
				  );
		}
		/**
    Build a tree from a postfix-ordered buffer of node information,
    or a cursor over such a buffer.
    */
		static build( data ) {
			return buildTree( data );
		}
	}
	Tree.empty = new Tree( NodeType.none, [], [], 0 );
	class FlatBufferCursor {
		constructor( buffer, index ) {
			this.buffer = buffer;
			this.index = index;
		}
		get id() {
			return this.buffer[ this.index - 4 ];
		}
		get start() {
			return this.buffer[ this.index - 3 ];
		}
		get end() {
			return this.buffer[ this.index - 2 ];
		}
		get size() {
			return this.buffer[ this.index - 1 ];
		}
		get pos() {
			return this.index;
		}
		next() {
			this.index -= 4;
		}
		fork() {
			return new FlatBufferCursor( this.buffer, this.index );
		}
	}
	class TreeBuffer {
		/**
    Create a tree buffer.
    */
		constructor( buffer, length, set ) {
			this.buffer = buffer;
			this.length = length;
			this.set = set;
		}
		/**
    @internal
    */
		get type() {
			return NodeType.none;
		}
		/**
    @internal
    */
		toString() {
			let result = [];
			for ( let index = 0; index < this.buffer.length;  ) {
				result.push( this.childString( index ) );
				index = this.buffer[ index + 3 ];
			}
			return result.join( ',' );
		}
		/**
    @internal
    */
		childString( index ) {
			let id = this.buffer[ index ],
				endIndex = this.buffer[ index + 3 ];
			let type = this.set.types[ id ],
				result = type.name;
			if ( /\W/.test( result ) && ! type.isError )
				result = JSON.stringify( result );
			index += 4;
			if ( endIndex == index ) return result;
			let children = [];
			while ( index < endIndex ) {
				children.push( this.childString( index ) );
				index = this.buffer[ index + 3 ];
			}
			return result + '(' + children.join( ',' ) + ')';
		}
		/**
    @internal
    */
		findChild( startIndex, endIndex, dir, pos, side ) {
			let { buffer } = this,
				pick = -1;
			for ( let i = startIndex; i != endIndex; i = buffer[ i + 3 ] ) {
				if (
					checkSide( side, pos, buffer[ i + 1 ], buffer[ i + 2 ] )
				) {
					pick = i;
					if ( dir > 0 ) break;
				}
			}
			return pick;
		}
		/**
    @internal
    */
		slice( startI, endI, from ) {
			let b = this.buffer;
			let copy = new Uint16Array( endI - startI ),
				len = 0;
			for ( let i = startI, j = 0; i < endI;  ) {
				copy[ j++ ] = b[ i++ ];
				copy[ j++ ] = b[ i++ ] - from;
				let to = ( copy[ j++ ] = b[ i++ ] - from );
				copy[ j++ ] = b[ i++ ] - startI;
				len = Math.max( len, to );
			}
			return new TreeBuffer( copy, len, this.set );
		}
	}
	function checkSide( side, pos, from, to ) {
		switch ( side ) {
			case -2:
				return from < pos;
			case -1:
				return to >= pos && from < pos;
			case 0:
				return from < pos && to > pos;
			case 1:
				return from <= pos && to > pos;
			case 2:
				return to > pos;
			case 4:
				return true;
		}
	}
	function resolveNode( node, pos, side, overlays ) {
		var _a;
		while (
			node.from == node.to ||
			( side < 1 ? node.from >= pos : node.from > pos ) ||
			( side > -1 ? node.to <= pos : node.to < pos )
		) {
			let parent =
				! overlays && node instanceof TreeNode && node.index < 0
					? null
					: node.parent;
			if ( ! parent ) return node;
			node = parent;
		}
		let mode = overlays ? 0 : IterMode.IgnoreOverlays;
		if ( overlays )
			for (
				let scan = node, parent = scan.parent;
				parent;
				scan = parent, parent = scan.parent
			) {
				if (
					scan instanceof TreeNode &&
					scan.index < 0 &&
					( ( _a = parent.enter( pos, side, mode ) ) === null ||
					_a === void 0
						? void 0
						: _a.from ) != scan.from
				)
					node = parent;
			}
		for (;;) {
			let inner = node.enter( pos, side, mode );
			if ( ! inner ) return node;
			node = inner;
		}
	}
	class BaseNode {
		cursor( mode = 0 ) {
			return new TreeCursor( this, mode );
		}
		getChild( type, before = null, after = null ) {
			let r = getChildren( this, type, before, after );
			return r.length ? r[ 0 ] : null;
		}
		getChildren( type, before = null, after = null ) {
			return getChildren( this, type, before, after );
		}
		resolve( pos, side = 0 ) {
			return resolveNode( this, pos, side, false );
		}
		resolveInner( pos, side = 0 ) {
			return resolveNode( this, pos, side, true );
		}
		matchContext( context ) {
			return matchNodeContext( this.parent, context );
		}
		enterUnfinishedNodesBefore( pos ) {
			let scan = this.childBefore( pos ),
				node = this;
			while ( scan ) {
				let last = scan.lastChild;
				if ( ! last || last.to != scan.to ) break;
				if ( last.type.isError && last.from == last.to ) {
					node = scan;
					scan = last.prevSibling;
				} else {
					scan = last;
				}
			}
			return node;
		}
		get node() {
			return this;
		}
		get next() {
			return this.parent;
		}
	}
	class TreeNode extends BaseNode {
		constructor( _tree, from, index, _parent ) {
			super();
			this._tree = _tree;
			this.from = from;
			this.index = index;
			this._parent = _parent;
		}
		get type() {
			return this._tree.type;
		}
		get name() {
			return this._tree.type.name;
		}
		get to() {
			return this.from + this._tree.length;
		}
		nextChild( i, dir, pos, side, mode = 0 ) {
			for ( let parent = this; ;  ) {
				for (
					let { children, positions } = parent._tree,
						e = dir > 0 ? children.length : -1;
					i != e;
					i += dir
				) {
					let next = children[ i ],
						start = positions[ i ] + parent.from;
					if ( ! checkSide( side, pos, start, start + next.length ) )
						continue;
					if ( next instanceof TreeBuffer ) {
						if ( mode & IterMode.ExcludeBuffers ) continue;
						let index = next.findChild(
							0,
							next.buffer.length,
							dir,
							pos - start,
							side
						);
						if ( index > -1 )
							return new BufferNode(
								new BufferContext( parent, next, i, start ),
								null,
								index
							);
					} else if (
						mode & IterMode.IncludeAnonymous ||
						! next.type.isAnonymous ||
						hasChild( next )
					) {
						let mounted;
						if (
							! ( mode & IterMode.IgnoreMounts ) &&
							( mounted = MountedTree.get( next ) ) &&
							! mounted.overlay
						)
							return new TreeNode(
								mounted.tree,
								start,
								i,
								parent
							);
						let inner = new TreeNode( next, start, i, parent );
						return mode & IterMode.IncludeAnonymous ||
							! inner.type.isAnonymous
							? inner
							: inner.nextChild(
									dir < 0 ? next.children.length - 1 : 0,
									dir,
									pos,
									side
							  );
					}
				}
				if (
					mode & IterMode.IncludeAnonymous ||
					! parent.type.isAnonymous
				)
					return null;
				if ( parent.index >= 0 ) i = parent.index + dir;
				else i = dir < 0 ? -1 : parent._parent._tree.children.length;
				parent = parent._parent;
				if ( ! parent ) return null;
			}
		}
		get firstChild() {
			return this.nextChild(
				0,
				1,
				0,
				4
				/* Side.DontCare */
			);
		}
		get lastChild() {
			return this.nextChild(
				this._tree.children.length - 1,
				-1,
				0,
				4
				/* Side.DontCare */
			);
		}
		childAfter( pos ) {
			return this.nextChild(
				0,
				1,
				pos,
				2
				/* Side.After */
			);
		}
		childBefore( pos ) {
			return this.nextChild(
				this._tree.children.length - 1,
				-1,
				pos,
				-2
				/* Side.Before */
			);
		}
		enter( pos, side, mode = 0 ) {
			let mounted;
			if (
				! ( mode & IterMode.IgnoreOverlays ) &&
				( mounted = MountedTree.get( this._tree ) ) &&
				mounted.overlay
			) {
				let rPos = pos - this.from;
				for ( let { from, to } of mounted.overlay ) {
					if (
						( side > 0 ? from <= rPos : from < rPos ) &&
						( side < 0 ? to >= rPos : to > rPos )
					)
						return new TreeNode(
							mounted.tree,
							mounted.overlay[ 0 ].from + this.from,
							-1,
							this
						);
				}
			}
			return this.nextChild( 0, 1, pos, side, mode );
		}
		nextSignificantParent() {
			let val = this;
			while ( val.type.isAnonymous && val._parent ) val = val._parent;
			return val;
		}
		get parent() {
			return this._parent ? this._parent.nextSignificantParent() : null;
		}
		get nextSibling() {
			return this._parent && this.index >= 0
				? this._parent.nextChild(
						this.index + 1,
						1,
						0,
						4
						/* Side.DontCare */
				  )
				: null;
		}
		get prevSibling() {
			return this._parent && this.index >= 0
				? this._parent.nextChild(
						this.index - 1,
						-1,
						0,
						4
						/* Side.DontCare */
				  )
				: null;
		}
		get tree() {
			return this._tree;
		}
		toTree() {
			return this._tree;
		}
		/**
    @internal
    */
		toString() {
			return this._tree.toString();
		}
	}
	function getChildren( node, type, before, after ) {
		let cur = node.cursor(),
			result = [];
		if ( ! cur.firstChild() ) return result;
		if ( before != null )
			for ( let found = false; ! found;  ) {
				found = cur.type.is( before );
				if ( ! cur.nextSibling() ) return result;
			}
		for (;;) {
			if ( after != null && cur.type.is( after ) ) return result;
			if ( cur.type.is( type ) ) result.push( cur.node );
			if ( ! cur.nextSibling() ) return after == null ? result : [];
		}
	}
	function matchNodeContext( node, context, i = context.length - 1 ) {
		for ( let p = node; i >= 0; p = p.parent ) {
			if ( ! p ) return false;
			if ( ! p.type.isAnonymous ) {
				if ( context[ i ] && context[ i ] != p.name ) return false;
				i--;
			}
		}
		return true;
	}
	class BufferContext {
		constructor( parent, buffer, index, start ) {
			this.parent = parent;
			this.buffer = buffer;
			this.index = index;
			this.start = start;
		}
	}
	class BufferNode extends BaseNode {
		get name() {
			return this.type.name;
		}
		get from() {
			return (
				this.context.start +
				this.context.buffer.buffer[ this.index + 1 ]
			);
		}
		get to() {
			return (
				this.context.start +
				this.context.buffer.buffer[ this.index + 2 ]
			);
		}
		constructor( context, _parent, index ) {
			super();
			this.context = context;
			this._parent = _parent;
			this.index = index;
			this.type =
				context.buffer.set.types[ context.buffer.buffer[ index ] ];
		}
		child( dir, pos, side ) {
			let { buffer } = this.context;
			let index = buffer.findChild(
				this.index + 4,
				buffer.buffer[ this.index + 3 ],
				dir,
				pos - this.context.start,
				side
			);
			return index < 0
				? null
				: new BufferNode( this.context, this, index );
		}
		get firstChild() {
			return this.child(
				1,
				0,
				4
				/* Side.DontCare */
			);
		}
		get lastChild() {
			return this.child(
				-1,
				0,
				4
				/* Side.DontCare */
			);
		}
		childAfter( pos ) {
			return this.child(
				1,
				pos,
				2
				/* Side.After */
			);
		}
		childBefore( pos ) {
			return this.child(
				-1,
				pos,
				-2
				/* Side.Before */
			);
		}
		enter( pos, side, mode = 0 ) {
			if ( mode & IterMode.ExcludeBuffers ) return null;
			let { buffer } = this.context;
			let index = buffer.findChild(
				this.index + 4,
				buffer.buffer[ this.index + 3 ],
				side > 0 ? 1 : -1,
				pos - this.context.start,
				side
			);
			return index < 0
				? null
				: new BufferNode( this.context, this, index );
		}
		get parent() {
			return this._parent || this.context.parent.nextSignificantParent();
		}
		externalSibling( dir ) {
			return this._parent
				? null
				: this.context.parent.nextChild(
						this.context.index + dir,
						dir,
						0,
						4
						/* Side.DontCare */
				  );
		}
		get nextSibling() {
			let { buffer } = this.context;
			let after = buffer.buffer[ this.index + 3 ];
			if (
				after <
				( this._parent
					? buffer.buffer[ this._parent.index + 3 ]
					: buffer.buffer.length )
			)
				return new BufferNode( this.context, this._parent, after );
			return this.externalSibling( 1 );
		}
		get prevSibling() {
			let { buffer } = this.context;
			let parentStart = this._parent ? this._parent.index + 4 : 0;
			if ( this.index == parentStart ) return this.externalSibling( -1 );
			return new BufferNode(
				this.context,
				this._parent,
				buffer.findChild(
					parentStart,
					this.index,
					-1,
					0,
					4
					/* Side.DontCare */
				)
			);
		}
		get tree() {
			return null;
		}
		toTree() {
			let children = [],
				positions = [];
			let { buffer } = this.context;
			let startI = this.index + 4,
				endI = buffer.buffer[ this.index + 3 ];
			if ( endI > startI ) {
				let from = buffer.buffer[ this.index + 1 ];
				children.push( buffer.slice( startI, endI, from ) );
				positions.push( 0 );
			}
			return new Tree(
				this.type,
				children,
				positions,
				this.to - this.from
			);
		}
		/**
    @internal
    */
		toString() {
			return this.context.buffer.childString( this.index );
		}
	}
	function iterStack( heads ) {
		if ( ! heads.length ) return null;
		let pick = 0,
			picked = heads[ 0 ];
		for ( let i = 1; i < heads.length; i++ ) {
			let node = heads[ i ];
			if ( node.from > picked.from || node.to < picked.to ) {
				picked = node;
				pick = i;
			}
		}
		let next =
			picked instanceof TreeNode && picked.index < 0
				? null
				: picked.parent;
		let newHeads = heads.slice();
		if ( next ) newHeads[ pick ] = next;
		else newHeads.splice( pick, 1 );
		return new StackIterator( newHeads, picked );
	}
	class StackIterator {
		constructor( heads, node ) {
			this.heads = heads;
			this.node = node;
		}
		get next() {
			return iterStack( this.heads );
		}
	}
	function stackIterator( tree, pos, side ) {
		let inner = tree.resolveInner( pos, side ),
			layers = null;
		for (
			let scan = inner instanceof TreeNode ? inner : inner.context.parent;
			scan;
			scan = scan.parent
		) {
			if ( scan.index < 0 ) {
				let parent = scan.parent;
				( layers || ( layers = [ inner ] ) ).push(
					parent.resolve( pos, side )
				);
				scan = parent;
			} else {
				let mount = MountedTree.get( scan.tree );
				if (
					mount &&
					mount.overlay &&
					mount.overlay[ 0 ].from <= pos &&
					mount.overlay[ mount.overlay.length - 1 ].to >= pos
				) {
					let root = new TreeNode(
						mount.tree,
						mount.overlay[ 0 ].from + scan.from,
						-1,
						scan
					);
					( layers || ( layers = [ inner ] ) ).push(
						resolveNode( root, pos, side, false )
					);
				}
			}
		}
		return layers ? iterStack( layers ) : inner;
	}
	class TreeCursor {
		/**
    Shorthand for `.type.name`.
    */
		get name() {
			return this.type.name;
		}
		/**
    @internal
    */
		constructor( node, mode = 0 ) {
			this.mode = mode;
			this.buffer = null;
			this.stack = [];
			this.index = 0;
			this.bufferNode = null;
			if ( node instanceof TreeNode ) {
				this.yieldNode( node );
			} else {
				this._tree = node.context.parent;
				this.buffer = node.context;
				for ( let n = node._parent; n; n = n._parent )
					this.stack.unshift( n.index );
				this.bufferNode = node;
				this.yieldBuf( node.index );
			}
		}
		yieldNode( node ) {
			if ( ! node ) return false;
			this._tree = node;
			this.type = node.type;
			this.from = node.from;
			this.to = node.to;
			return true;
		}
		yieldBuf( index, type ) {
			this.index = index;
			let { start, buffer } = this.buffer;
			this.type = type || buffer.set.types[ buffer.buffer[ index ] ];
			this.from = start + buffer.buffer[ index + 1 ];
			this.to = start + buffer.buffer[ index + 2 ];
			return true;
		}
		/**
    @internal
    */
		yield( node ) {
			if ( ! node ) return false;
			if ( node instanceof TreeNode ) {
				this.buffer = null;
				return this.yieldNode( node );
			}
			this.buffer = node.context;
			return this.yieldBuf( node.index, node.type );
		}
		/**
    @internal
    */
		toString() {
			return this.buffer
				? this.buffer.buffer.childString( this.index )
				: this._tree.toString();
		}
		/**
    @internal
    */
		enterChild( dir, pos, side ) {
			if ( ! this.buffer )
				return this.yield(
					this._tree.nextChild(
						dir < 0 ? this._tree._tree.children.length - 1 : 0,
						dir,
						pos,
						side,
						this.mode
					)
				);
			let { buffer } = this.buffer;
			let index = buffer.findChild(
				this.index + 4,
				buffer.buffer[ this.index + 3 ],
				dir,
				pos - this.buffer.start,
				side
			);
			if ( index < 0 ) return false;
			this.stack.push( this.index );
			return this.yieldBuf( index );
		}
		/**
    Move the cursor to this node's first child. When this returns
    false, the node has no child, and the cursor has not been moved.
    */
		firstChild() {
			return this.enterChild(
				1,
				0,
				4
				/* Side.DontCare */
			);
		}
		/**
    Move the cursor to this node's last child.
    */
		lastChild() {
			return this.enterChild(
				-1,
				0,
				4
				/* Side.DontCare */
			);
		}
		/**
    Move the cursor to the first child that ends after `pos`.
    */
		childAfter( pos ) {
			return this.enterChild(
				1,
				pos,
				2
				/* Side.After */
			);
		}
		/**
    Move to the last child that starts before `pos`.
    */
		childBefore( pos ) {
			return this.enterChild(
				-1,
				pos,
				-2
				/* Side.Before */
			);
		}
		/**
    Move the cursor to the child around `pos`. If side is -1 the
    child may end at that position, when 1 it may start there. This
    will also enter [overlaid](#common.MountedTree.overlay)
    [mounted](#common.NodeProp^mounted) trees unless `overlays` is
    set to false.
    */
		enter( pos, side, mode = this.mode ) {
			if ( ! this.buffer )
				return this.yield( this._tree.enter( pos, side, mode ) );
			return mode & IterMode.ExcludeBuffers
				? false
				: this.enterChild( 1, pos, side );
		}
		/**
    Move to the node's parent node, if this isn't the top node.
    */
		parent() {
			if ( ! this.buffer )
				return this.yieldNode(
					this.mode & IterMode.IncludeAnonymous
						? this._tree._parent
						: this._tree.parent
				);
			if ( this.stack.length ) return this.yieldBuf( this.stack.pop() );
			let parent =
				this.mode & IterMode.IncludeAnonymous
					? this.buffer.parent
					: this.buffer.parent.nextSignificantParent();
			this.buffer = null;
			return this.yieldNode( parent );
		}
		/**
    @internal
    */
		sibling( dir ) {
			if ( ! this.buffer )
				return ! this._tree._parent
					? false
					: this.yield(
							this._tree.index < 0
								? null
								: this._tree._parent.nextChild(
										this._tree.index + dir,
										dir,
										0,
										4,
										this.mode
								  )
					  );
			let { buffer } = this.buffer,
				d = this.stack.length - 1;
			if ( dir < 0 ) {
				let parentStart = d < 0 ? 0 : this.stack[ d ] + 4;
				if ( this.index != parentStart )
					return this.yieldBuf(
						buffer.findChild(
							parentStart,
							this.index,
							-1,
							0,
							4
							/* Side.DontCare */
						)
					);
			} else {
				let after = buffer.buffer[ this.index + 3 ];
				if (
					after <
					( d < 0
						? buffer.buffer.length
						: buffer.buffer[ this.stack[ d ] + 3 ] )
				)
					return this.yieldBuf( after );
			}
			return d < 0
				? this.yield(
						this.buffer.parent.nextChild(
							this.buffer.index + dir,
							dir,
							0,
							4,
							this.mode
						)
				  )
				: false;
		}
		/**
    Move to this node's next sibling, if any.
    */
		nextSibling() {
			return this.sibling( 1 );
		}
		/**
    Move to this node's previous sibling, if any.
    */
		prevSibling() {
			return this.sibling( -1 );
		}
		atLastNode( dir ) {
			let index,
				parent,
				{ buffer } = this;
			if ( buffer ) {
				if ( dir > 0 ) {
					if ( this.index < buffer.buffer.buffer.length )
						return false;
				} else {
					for ( let i = 0; i < this.index; i++ )
						if ( buffer.buffer.buffer[ i + 3 ] < this.index )
							return false;
				}
				( { index, parent } = buffer );
			} else {
				( { index, _parent: parent } = this._tree );
			}
			for ( ; parent; { index, _parent: parent } = parent ) {
				if ( index > -1 )
					for (
						let i = index + dir,
							e = dir < 0 ? -1 : parent._tree.children.length;
						i != e;
						i += dir
					) {
						let child = parent._tree.children[ i ];
						if (
							this.mode & IterMode.IncludeAnonymous ||
							child instanceof TreeBuffer ||
							! child.type.isAnonymous ||
							hasChild( child )
						)
							return false;
					}
			}
			return true;
		}
		move( dir, enter ) {
			if (
				enter &&
				this.enterChild(
					dir,
					0,
					4
					/* Side.DontCare */
				)
			)
				return true;
			for (;;) {
				if ( this.sibling( dir ) ) return true;
				if ( this.atLastNode( dir ) || ! this.parent() ) return false;
			}
		}
		/**
    Move to the next node in a
    [pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
    traversal, going from a node to its first child or, if the
    current node is empty or `enter` is false, its next sibling or
    the next sibling of the first parent node that has one.
    */
		next( enter = true ) {
			return this.move( 1, enter );
		}
		/**
    Move to the next node in a last-to-first pre-order traversal. A
    node is followed by its last child or, if it has none, its
    previous sibling or the previous sibling of the first parent
    node that has one.
    */
		prev( enter = true ) {
			return this.move( -1, enter );
		}
		/**
    Move the cursor to the innermost node that covers `pos`. If
    `side` is -1, it will enter nodes that end at `pos`. If it is 1,
    it will enter nodes that start at `pos`.
    */
		moveTo( pos, side = 0 ) {
			while (
				this.from == this.to ||
				( side < 1 ? this.from >= pos : this.from > pos ) ||
				( side > -1 ? this.to <= pos : this.to < pos )
			)
				if ( ! this.parent() ) break;
			while ( this.enterChild( 1, pos, side ) ) {}
			return this;
		}
		/**
    Get a [syntax node](#common.SyntaxNode) at the cursor's current
    position.
    */
		get node() {
			if ( ! this.buffer ) return this._tree;
			let cache = this.bufferNode,
				result = null,
				depth = 0;
			if ( cache && cache.context == this.buffer ) {
				scan: for (
					let index = this.index, d = this.stack.length;
					d >= 0;

				) {
					for ( let c = cache; c; c = c._parent )
						if ( c.index == index ) {
							if ( index == this.index ) return c;
							result = c;
							depth = d + 1;
							break scan;
						}
					index = this.stack[ --d ];
				}
			}
			for ( let i = depth; i < this.stack.length; i++ )
				result = new BufferNode( this.buffer, result, this.stack[ i ] );
			return ( this.bufferNode = new BufferNode(
				this.buffer,
				result,
				this.index
			) );
		}
		/**
    Get the [tree](#common.Tree) that represents the current node, if
    any. Will return null when the node is in a [tree
    buffer](#common.TreeBuffer).
    */
		get tree() {
			return this.buffer ? null : this._tree._tree;
		}
		/**
    Iterate over the current node and all its descendants, calling
    `enter` when entering a node and `leave`, if given, when leaving
    one. When `enter` returns `false`, any children of that node are
    skipped, and `leave` isn't called for it.
    */
		iterate( enter, leave ) {
			for ( let depth = 0; ;  ) {
				let mustLeave = false;
				if ( this.type.isAnonymous || enter( this ) !== false ) {
					if ( this.firstChild() ) {
						depth++;
						continue;
					}
					if ( ! this.type.isAnonymous ) mustLeave = true;
				}
				for (;;) {
					if ( mustLeave && leave ) leave( this );
					mustLeave = this.type.isAnonymous;
					if ( ! depth ) return;
					if ( this.nextSibling() ) break;
					this.parent();
					depth--;
					mustLeave = true;
				}
			}
		}
		/**
    Test whether the current node matches a given context—a sequence
    of direct parent node names. Empty strings in the context array
    are treated as wildcards.
    */
		matchContext( context ) {
			if ( ! this.buffer )
				return matchNodeContext( this.node.parent, context );
			let { buffer } = this.buffer,
				{ types } = buffer.set;
			for (
				let i = context.length - 1, d = this.stack.length - 1;
				i >= 0;
				d--
			) {
				if ( d < 0 ) return matchNodeContext( this._tree, context, i );
				let type = types[ buffer.buffer[ this.stack[ d ] ] ];
				if ( ! type.isAnonymous ) {
					if ( context[ i ] && context[ i ] != type.name )
						return false;
					i--;
				}
			}
			return true;
		}
	}
	function hasChild( tree ) {
		return tree.children.some(
			( ch ) =>
				ch instanceof TreeBuffer ||
				! ch.type.isAnonymous ||
				hasChild( ch )
		);
	}
	function buildTree( data ) {
		var _a;
		let {
			buffer,
			nodeSet,
			maxBufferLength = DefaultBufferLength,
			reused = [],
			minRepeatType = nodeSet.types.length,
		} = data;
		let cursor = Array.isArray( buffer )
			? new FlatBufferCursor( buffer, buffer.length )
			: buffer;
		let types = nodeSet.types;
		let contextHash = 0,
			lookAhead = 0;
		function takeNode(
			parentStart,
			minPos,
			children2,
			positions2,
			inRepeat,
			depth
		) {
			let { id, start, end, size } = cursor;
			let lookAheadAtStart = lookAhead,
				contextAtStart = contextHash;
			while ( size < 0 ) {
				cursor.next();
				if ( size == -1 ) {
					let node2 = reused[ id ];
					children2.push( node2 );
					positions2.push( start - parentStart );
					return;
				} else if ( size == -3 ) {
					contextHash = id;
					return;
				} else if ( size == -4 ) {
					lookAhead = id;
					return;
				} else {
					throw new RangeError(
						`Unrecognized record size: ${ size }`
					);
				}
			}
			let type = types[ id ],
				node,
				buffer2;
			let startPos = start - parentStart;
			if (
				end - start <= maxBufferLength &&
				( buffer2 = findBufferSize( cursor.pos - minPos, inRepeat ) )
			) {
				let data2 = new Uint16Array( buffer2.size - buffer2.skip );
				let endPos = cursor.pos - buffer2.size,
					index = data2.length;
				while ( cursor.pos > endPos )
					index = copyToBuffer( buffer2.start, data2, index );
				node = new TreeBuffer( data2, end - buffer2.start, nodeSet );
				startPos = buffer2.start - parentStart;
			} else {
				let endPos = cursor.pos - size;
				cursor.next();
				let localChildren = [],
					localPositions = [];
				let localInRepeat = id >= minRepeatType ? id : -1;
				let lastGroup = 0,
					lastEnd = end;
				while ( cursor.pos > endPos ) {
					if (
						localInRepeat >= 0 &&
						cursor.id == localInRepeat &&
						cursor.size >= 0
					) {
						if ( cursor.end <= lastEnd - maxBufferLength ) {
							makeRepeatLeaf(
								localChildren,
								localPositions,
								start,
								lastGroup,
								cursor.end,
								lastEnd,
								localInRepeat,
								lookAheadAtStart,
								contextAtStart
							);
							lastGroup = localChildren.length;
							lastEnd = cursor.end;
						}
						cursor.next();
					} else if ( depth > 2500 ) {
						takeFlatNode(
							start,
							endPos,
							localChildren,
							localPositions
						);
					} else {
						takeNode(
							start,
							endPos,
							localChildren,
							localPositions,
							localInRepeat,
							depth + 1
						);
					}
				}
				if (
					localInRepeat >= 0 &&
					lastGroup > 0 &&
					lastGroup < localChildren.length
				)
					makeRepeatLeaf(
						localChildren,
						localPositions,
						start,
						lastGroup,
						start,
						lastEnd,
						localInRepeat,
						lookAheadAtStart,
						contextAtStart
					);
				localChildren.reverse();
				localPositions.reverse();
				if ( localInRepeat > -1 && lastGroup > 0 ) {
					let make = makeBalanced( type, contextAtStart );
					node = balanceRange(
						type,
						localChildren,
						localPositions,
						0,
						localChildren.length,
						0,
						end - start,
						make,
						make
					);
				} else {
					node = makeTree(
						type,
						localChildren,
						localPositions,
						end - start,
						lookAheadAtStart - end,
						contextAtStart
					);
				}
			}
			children2.push( node );
			positions2.push( startPos );
		}
		function takeFlatNode( parentStart, minPos, children2, positions2 ) {
			let nodes = [];
			let nodeCount = 0,
				stopAt = -1;
			while ( cursor.pos > minPos ) {
				let { id, start, end, size } = cursor;
				if ( size > 4 ) {
					cursor.next();
				} else if ( stopAt > -1 && start < stopAt ) {
					break;
				} else {
					if ( stopAt < 0 ) stopAt = end - maxBufferLength;
					nodes.push( id, start, end );
					nodeCount++;
					cursor.next();
				}
			}
			if ( nodeCount ) {
				let buffer2 = new Uint16Array( nodeCount * 4 );
				let start = nodes[ nodes.length - 2 ];
				for ( let i = nodes.length - 3, j = 0; i >= 0; i -= 3 ) {
					buffer2[ j++ ] = nodes[ i ];
					buffer2[ j++ ] = nodes[ i + 1 ] - start;
					buffer2[ j++ ] = nodes[ i + 2 ] - start;
					buffer2[ j++ ] = j;
				}
				children2.push(
					new TreeBuffer( buffer2, nodes[ 2 ] - start, nodeSet )
				);
				positions2.push( start - parentStart );
			}
		}
		function makeBalanced( type, contextHash2 ) {
			return ( children2, positions2, length2 ) => {
				let lookAhead2 = 0,
					lastI = children2.length - 1,
					last,
					lookAheadProp;
				if (
					lastI >= 0 &&
					( last = children2[ lastI ] ) instanceof Tree
				) {
					if (
						! lastI &&
						last.type == type &&
						last.length == length2
					)
						return last;
					if ( ( lookAheadProp = last.prop( NodeProp.lookAhead ) ) )
						lookAhead2 =
							positions2[ lastI ] + last.length + lookAheadProp;
				}
				return makeTree(
					type,
					children2,
					positions2,
					length2,
					lookAhead2,
					contextHash2
				);
			};
		}
		function makeRepeatLeaf(
			children2,
			positions2,
			base,
			i,
			from,
			to,
			type,
			lookAhead2,
			contextHash2
		) {
			let localChildren = [],
				localPositions = [];
			while ( children2.length > i ) {
				localChildren.push( children2.pop() );
				localPositions.push( positions2.pop() + base - from );
			}
			children2.push(
				makeTree(
					nodeSet.types[ type ],
					localChildren,
					localPositions,
					to - from,
					lookAhead2 - to,
					contextHash2
				)
			);
			positions2.push( from - base );
		}
		function makeTree(
			type,
			children2,
			positions2,
			length2,
			lookAhead2,
			contextHash2,
			props
		) {
			if ( contextHash2 ) {
				let pair2 = [ NodeProp.contextHash, contextHash2 ];
				props = props ? [ pair2 ].concat( props ) : [ pair2 ];
			}
			if ( lookAhead2 > 25 ) {
				let pair2 = [ NodeProp.lookAhead, lookAhead2 ];
				props = props ? [ pair2 ].concat( props ) : [ pair2 ];
			}
			return new Tree( type, children2, positions2, length2, props );
		}
		function findBufferSize( maxSize, inRepeat ) {
			let fork = cursor.fork();
			let size = 0,
				start = 0,
				skip = 0,
				minStart = fork.end - maxBufferLength;
			let result = { size: 0, start: 0, skip: 0 };
			scan: for ( let minPos = fork.pos - maxSize; fork.pos > minPos;  ) {
				let nodeSize2 = fork.size;
				if ( fork.id == inRepeat && nodeSize2 >= 0 ) {
					result.size = size;
					result.start = start;
					result.skip = skip;
					skip += 4;
					size += 4;
					fork.next();
					continue;
				}
				let startPos = fork.pos - nodeSize2;
				if (
					nodeSize2 < 0 ||
					startPos < minPos ||
					fork.start < minStart
				)
					break;
				let localSkipped = fork.id >= minRepeatType ? 4 : 0;
				let nodeStart = fork.start;
				fork.next();
				while ( fork.pos > startPos ) {
					if ( fork.size < 0 ) {
						if ( fork.size == -3 ) localSkipped += 4;
						else break scan;
					} else if ( fork.id >= minRepeatType ) {
						localSkipped += 4;
					}
					fork.next();
				}
				start = nodeStart;
				size += nodeSize2;
				skip += localSkipped;
			}
			if ( inRepeat < 0 || size == maxSize ) {
				result.size = size;
				result.start = start;
				result.skip = skip;
			}
			return result.size > 4 ? result : void 0;
		}
		function copyToBuffer( bufferStart, buffer2, index ) {
			let { id, start, end, size } = cursor;
			cursor.next();
			if ( size >= 0 && id < minRepeatType ) {
				let startIndex = index;
				if ( size > 4 ) {
					let endPos = cursor.pos - ( size - 4 );
					while ( cursor.pos > endPos )
						index = copyToBuffer( bufferStart, buffer2, index );
				}
				buffer2[ --index ] = startIndex;
				buffer2[ --index ] = end - bufferStart;
				buffer2[ --index ] = start - bufferStart;
				buffer2[ --index ] = id;
			} else if ( size == -3 ) {
				contextHash = id;
			} else if ( size == -4 ) {
				lookAhead = id;
			}
			return index;
		}
		let children = [],
			positions = [];
		while ( cursor.pos > 0 )
			takeNode(
				data.start || 0,
				data.bufferStart || 0,
				children,
				positions,
				-1,
				0
			);
		let length =
			( _a = data.length ) !== null && _a !== void 0
				? _a
				: children.length
				? positions[ 0 ] + children[ 0 ].length
				: 0;
		return new Tree(
			types[ data.topID ],
			children.reverse(),
			positions.reverse(),
			length
		);
	}
	const nodeSizeCache = /* @__PURE__ */ new WeakMap();
	function nodeSize( balanceType, node ) {
		if (
			! balanceType.isAnonymous ||
			node instanceof TreeBuffer ||
			node.type != balanceType
		)
			return 1;
		let size = nodeSizeCache.get( node );
		if ( size == null ) {
			size = 1;
			for ( let child of node.children ) {
				if (
					child.type != balanceType ||
					! ( child instanceof Tree )
				) {
					size = 1;
					break;
				}
				size += nodeSize( balanceType, child );
			}
			nodeSizeCache.set( node, size );
		}
		return size;
	}
	function balanceRange(
		balanceType,
		children,
		positions,
		from,
		to,
		start,
		length,
		mkTop,
		mkTree
	) {
		let total = 0;
		for ( let i = from; i < to; i++ )
			total += nodeSize( balanceType, children[ i ] );
		let maxChild = Math.ceil(
			( total * 1.5 ) / 8
			/* Balance.BranchFactor */
		);
		let localChildren = [],
			localPositions = [];
		function divide( children2, positions2, from2, to2, offset ) {
			for ( let i = from2; i < to2;  ) {
				let groupFrom = i,
					groupStart = positions2[ i ],
					groupSize = nodeSize( balanceType, children2[ i ] );
				i++;
				for ( ; i < to2; i++ ) {
					let nextSize = nodeSize( balanceType, children2[ i ] );
					if ( groupSize + nextSize >= maxChild ) break;
					groupSize += nextSize;
				}
				if ( i == groupFrom + 1 ) {
					if ( groupSize > maxChild ) {
						let only = children2[ groupFrom ];
						divide(
							only.children,
							only.positions,
							0,
							only.children.length,
							positions2[ groupFrom ] + offset
						);
						continue;
					}
					localChildren.push( children2[ groupFrom ] );
				} else {
					let length2 =
						positions2[ i - 1 ] +
						children2[ i - 1 ].length -
						groupStart;
					localChildren.push(
						balanceRange(
							balanceType,
							children2,
							positions2,
							groupFrom,
							i,
							groupStart,
							length2,
							null,
							mkTree
						)
					);
				}
				localPositions.push( groupStart + offset - start );
			}
		}
		divide( children, positions, from, to, 0 );
		return ( mkTop || mkTree )( localChildren, localPositions, length );
	}
	class Parser {
		/**
    Start a parse, returning a [partial parse](#common.PartialParse)
    object. [`fragments`](#common.TreeFragment) can be passed in to
    make the parse incremental.
    
    By default, the entire input is parsed. You can pass `ranges`,
    which should be a sorted array of non-empty, non-overlapping
    ranges, to parse only those ranges. The tree returned in that
    case will start at `ranges[0].from`.
    */
		startParse( input, fragments, ranges ) {
			if ( typeof input == 'string' ) input = new StringInput( input );
			ranges = ! ranges
				? [ new Range( 0, input.length ) ]
				: ranges.length
				? ranges.map( ( r ) => new Range( r.from, r.to ) )
				: [ new Range( 0, 0 ) ];
			return this.createParse( input, fragments || [], ranges );
		}
		/**
    Run a full parse, returning the resulting tree.
    */
		parse( input, fragments, ranges ) {
			let parse = this.startParse( input, fragments, ranges );
			for (;;) {
				let done = parse.advance();
				if ( done ) return done;
			}
		}
	}
	class StringInput {
		constructor( string2 ) {
			this.string = string2;
		}
		get length() {
			return this.string.length;
		}
		chunk( from ) {
			return this.string.slice( from );
		}
		get lineChunks() {
			return false;
		}
		read( from, to ) {
			return this.string.slice( from, to );
		}
	}
	new NodeProp( { perNode: true } );
	let nextTagID = 0;
	class Tag {
		/**
    @internal
    */
		constructor( name2, set, base, modified ) {
			this.name = name2;
			this.set = set;
			this.base = base;
			this.modified = modified;
			this.id = nextTagID++;
		}
		toString() {
			let { name: name2 } = this;
			for ( let mod of this.modified )
				if ( mod.name ) name2 = `${ mod.name }(${ name2 })`;
			return name2;
		}
		static define( nameOrParent, parent ) {
			let name2 = typeof nameOrParent == 'string' ? nameOrParent : '?';
			if ( nameOrParent instanceof Tag ) parent = nameOrParent;
			if ( parent === null || parent === void 0 ? void 0 : parent.base )
				throw new Error( 'Can not derive from a modified tag' );
			let tag = new Tag( name2, [], null, [] );
			tag.set.push( tag );
			if ( parent ) for ( let t2 of parent.set ) tag.set.push( t2 );
			return tag;
		}
		/**
    Define a tag _modifier_, which is a function that, given a tag,
    will return a tag that is a subtag of the original. Applying the
    same modifier to a twice tag will return the same value (`m1(t1)
    == m1(t1)`) and applying multiple modifiers will, regardless or
    order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
    
    When multiple modifiers are applied to a given base tag, each
    smaller set of modifiers is registered as a parent, so that for
    example `m1(m2(m3(t1)))` is a subtype of `m1(m2(t1))`,
    `m1(m3(t1)`, and so on.
    */
		static defineModifier( name2 ) {
			let mod = new Modifier( name2 );
			return ( tag ) => {
				if ( tag.modified.indexOf( mod ) > -1 ) return tag;
				return Modifier.get(
					tag.base || tag,
					tag.modified.concat( mod ).sort( ( a, b ) => a.id - b.id )
				);
			};
		}
	}
	let nextModifierID = 0;
	class Modifier {
		constructor( name2 ) {
			this.name = name2;
			this.instances = [];
			this.id = nextModifierID++;
		}
		static get( base, mods ) {
			if ( ! mods.length ) return base;
			let exists = mods[ 0 ].instances.find(
				( t2 ) => t2.base == base && sameArray( mods, t2.modified )
			);
			if ( exists ) return exists;
			let set = [],
				tag = new Tag( base.name, set, base, mods );
			for ( let m of mods ) m.instances.push( tag );
			let configs = powerSet( mods );
			for ( let parent of base.set )
				if ( ! parent.modified.length )
					for ( let config of configs )
						set.push( Modifier.get( parent, config ) );
			return tag;
		}
	}
	function sameArray( a, b ) {
		return a.length == b.length && a.every( ( x, i ) => x == b[ i ] );
	}
	function powerSet( array ) {
		let sets = [ [] ];
		for ( let i = 0; i < array.length; i++ ) {
			for ( let j = 0, e = sets.length; j < e; j++ ) {
				sets.push( sets[ j ].concat( array[ i ] ) );
			}
		}
		return sets.sort( ( a, b ) => b.length - a.length );
	}
	function styleTags( spec ) {
		let byName = /* @__PURE__ */ Object.create( null );
		for ( let prop in spec ) {
			let tags2 = spec[ prop ];
			if ( ! Array.isArray( tags2 ) ) tags2 = [ tags2 ];
			for ( let part of prop.split( ' ' ) )
				if ( part ) {
					let pieces = [],
						mode = 2,
						rest = part;
					for ( let pos = 0; ;  ) {
						if (
							rest == '...' &&
							pos > 0 &&
							pos + 3 == part.length
						) {
							mode = 1;
							break;
						}
						let m = /^"(?:[^"\\]|\\.)*?"|[^\/!]+/.exec( rest );
						if ( ! m )
							throw new RangeError( 'Invalid path: ' + part );
						pieces.push(
							m[ 0 ] == '*'
								? ''
								: m[ 0 ][ 0 ] == '"'
								? JSON.parse( m[ 0 ] )
								: m[ 0 ]
						);
						pos += m[ 0 ].length;
						if ( pos == part.length ) break;
						let next = part[ pos++ ];
						if ( pos == part.length && next == '!' ) {
							mode = 0;
							break;
						}
						if ( next != '/' )
							throw new RangeError( 'Invalid path: ' + part );
						rest = part.slice( pos );
					}
					let last = pieces.length - 1,
						inner = pieces[ last ];
					if ( ! inner )
						throw new RangeError( 'Invalid path: ' + part );
					let rule = new Rule(
						tags2,
						mode,
						last > 0 ? pieces.slice( 0, last ) : null
					);
					byName[ inner ] = rule.sort( byName[ inner ] );
				}
		}
		return ruleNodeProp.add( byName );
	}
	const ruleNodeProp = new NodeProp();
	class Rule {
		constructor( tags2, mode, context, next ) {
			this.tags = tags2;
			this.mode = mode;
			this.context = context;
			this.next = next;
		}
		get opaque() {
			return this.mode == 0;
		}
		get inherit() {
			return this.mode == 1;
		}
		sort( other ) {
			if ( ! other || other.depth < this.depth ) {
				this.next = other;
				return this;
			}
			other.next = this.sort( other.next );
			return other;
		}
		get depth() {
			return this.context ? this.context.length : 0;
		}
	}
	Rule.empty = new Rule( [], 2, null );
	function tagHighlighter( tags2, options ) {
		let map = /* @__PURE__ */ Object.create( null );
		for ( let style of tags2 ) {
			if ( ! Array.isArray( style.tag ) )
				map[ style.tag.id ] = style.class;
			else for ( let tag of style.tag ) map[ tag.id ] = style.class;
		}
		let { scope, all = null } = {};
		return {
			style: ( tags3 ) => {
				let cls = all;
				for ( let tag of tags3 ) {
					for ( let sub of tag.set ) {
						let tagClass = map[ sub.id ];
						if ( tagClass ) {
							cls = cls ? cls + ' ' + tagClass : tagClass;
							break;
						}
					}
				}
				return cls;
			},
			scope,
		};
	}
	function highlightTags( highlighters, tags2 ) {
		let result = null;
		for ( let highlighter2 of highlighters ) {
			let value = highlighter2.style( tags2 );
			if ( value ) result = result ? result + ' ' + value : value;
		}
		return result;
	}
	function highlightTree(
		tree,
		highlighter2,
		putStyle,
		from = 0,
		to = tree.length
	) {
		let builder = new HighlightBuilder(
			from,
			Array.isArray( highlighter2 ) ? highlighter2 : [ highlighter2 ],
			putStyle
		);
		builder.highlightRange(
			tree.cursor(),
			from,
			to,
			'',
			builder.highlighters
		);
		builder.flush( to );
	}
	function highlightCode(
		code,
		tree,
		highlighter2,
		putText,
		putBreak,
		from = 0,
		to = code.length
	) {
		let pos = from;
		function writeTo( p, classes ) {
			if ( p <= pos ) return;
			for ( let text = code.slice( pos, p ), i = 0; ;  ) {
				let nextBreak = text.indexOf( '\n', i );
				let upto = nextBreak < 0 ? text.length : nextBreak;
				if ( upto > i ) putText( text.slice( i, upto ), classes );
				if ( nextBreak < 0 ) break;
				putBreak();
				i = nextBreak + 1;
			}
			pos = p;
		}
		highlightTree(
			tree,
			highlighter2,
			( from2, to2, classes ) => {
				writeTo( from2, '' );
				writeTo( to2, classes );
			},
			from,
			to
		);
		writeTo( to, '' );
	}
	class HighlightBuilder {
		constructor( at, highlighters, span ) {
			this.at = at;
			this.highlighters = highlighters;
			this.span = span;
			this.class = '';
		}
		startSpan( at, cls ) {
			if ( cls != this.class ) {
				this.flush( at );
				if ( at > this.at ) this.at = at;
				this.class = cls;
			}
		}
		flush( to ) {
			if ( to > this.at && this.class )
				this.span( this.at, to, this.class );
		}
		highlightRange( cursor, from, to, inheritedClass, highlighters ) {
			let { type, from: start, to: end } = cursor;
			if ( start >= to || end <= from ) return;
			if ( type.isTop )
				highlighters = this.highlighters.filter(
					( h ) => ! h.scope || h.scope( type )
				);
			let cls = inheritedClass;
			let rule = getStyleTags( cursor ) || Rule.empty;
			let tagCls = highlightTags( highlighters, rule.tags );
			if ( tagCls ) {
				if ( cls ) cls += ' ';
				cls += tagCls;
				if ( rule.mode == 1 )
					inheritedClass += ( inheritedClass ? ' ' : '' ) + tagCls;
			}
			this.startSpan( Math.max( from, start ), cls );
			if ( rule.opaque ) return;
			let mounted = cursor.tree && cursor.tree.prop( NodeProp.mounted );
			if ( mounted && mounted.overlay ) {
				let inner = cursor.node.enter(
					mounted.overlay[ 0 ].from + start,
					1
				);
				let innerHighlighters = this.highlighters.filter(
					( h ) => ! h.scope || h.scope( mounted.tree.type )
				);
				let hasChild2 = cursor.firstChild();
				for ( let i = 0, pos = start; ; i++ ) {
					let next =
						i < mounted.overlay.length
							? mounted.overlay[ i ]
							: null;
					let nextPos = next ? next.from + start : end;
					let rangeFrom = Math.max( from, pos ),
						rangeTo = Math.min( to, nextPos );
					if ( rangeFrom < rangeTo && hasChild2 ) {
						while ( cursor.from < rangeTo ) {
							this.highlightRange(
								cursor,
								rangeFrom,
								rangeTo,
								inheritedClass,
								highlighters
							);
							this.startSpan(
								Math.min( rangeTo, cursor.to ),
								cls
							);
							if (
								cursor.to >= nextPos ||
								! cursor.nextSibling()
							)
								break;
						}
					}
					if ( ! next || nextPos > to ) break;
					pos = next.to + start;
					if ( pos > from ) {
						this.highlightRange(
							inner.cursor(),
							Math.max( from, next.from + start ),
							Math.min( to, pos ),
							'',
							innerHighlighters
						);
						this.startSpan( Math.min( to, pos ), cls );
					}
				}
				if ( hasChild2 ) cursor.parent();
			} else if ( cursor.firstChild() ) {
				if ( mounted ) inheritedClass = '';
				do {
					if ( cursor.to <= from ) continue;
					if ( cursor.from >= to ) break;
					this.highlightRange(
						cursor,
						from,
						to,
						inheritedClass,
						highlighters
					);
					this.startSpan( Math.min( to, cursor.to ), cls );
				} while ( cursor.nextSibling() );
				cursor.parent();
			}
		}
	}
	function getStyleTags( node ) {
		let rule = node.type.prop( ruleNodeProp );
		while ( rule && rule.context && ! node.matchContext( rule.context ) )
			rule = rule.next;
		return rule || null;
	}
	const t = Tag.define;
	const comment = t(),
		name = t(),
		typeName = t( name ),
		propertyName = t( name ),
		literal = t(),
		string = t( literal ),
		number = t( literal ),
		content = t(),
		heading = t( content ),
		keyword = t(),
		operator = t(),
		punctuation = t(),
		bracket = t( punctuation ),
		meta = t();
	const tags = {
		/**
    A comment.
    */
		comment,
		/**
    A line [comment](#highlight.tags.comment).
    */
		lineComment: t( comment ),
		/**
    A block [comment](#highlight.tags.comment).
    */
		blockComment: t( comment ),
		/**
    A documentation [comment](#highlight.tags.comment).
    */
		docComment: t( comment ),
		/**
    Any kind of identifier.
    */
		name,
		/**
    The [name](#highlight.tags.name) of a variable.
    */
		variableName: t( name ),
		/**
    A type [name](#highlight.tags.name).
    */
		typeName,
		/**
    A tag name (subtag of [`typeName`](#highlight.tags.typeName)).
    */
		tagName: t( typeName ),
		/**
    A property or field [name](#highlight.tags.name).
    */
		propertyName,
		/**
    An attribute name (subtag of [`propertyName`](#highlight.tags.propertyName)).
    */
		attributeName: t( propertyName ),
		/**
    The [name](#highlight.tags.name) of a class.
    */
		className: t( name ),
		/**
    A label [name](#highlight.tags.name).
    */
		labelName: t( name ),
		/**
    A namespace [name](#highlight.tags.name).
    */
		namespace: t( name ),
		/**
    The [name](#highlight.tags.name) of a macro.
    */
		macroName: t( name ),
		/**
    A literal value.
    */
		literal,
		/**
    A string [literal](#highlight.tags.literal).
    */
		string,
		/**
    A documentation [string](#highlight.tags.string).
    */
		docString: t( string ),
		/**
    A character literal (subtag of [string](#highlight.tags.string)).
    */
		character: t( string ),
		/**
    An attribute value (subtag of [string](#highlight.tags.string)).
    */
		attributeValue: t( string ),
		/**
    A number [literal](#highlight.tags.literal).
    */
		number,
		/**
    An integer [number](#highlight.tags.number) literal.
    */
		integer: t( number ),
		/**
    A floating-point [number](#highlight.tags.number) literal.
    */
		float: t( number ),
		/**
    A boolean [literal](#highlight.tags.literal).
    */
		bool: t( literal ),
		/**
    Regular expression [literal](#highlight.tags.literal).
    */
		regexp: t( literal ),
		/**
    An escape [literal](#highlight.tags.literal), for example a
    backslash escape in a string.
    */
		escape: t( literal ),
		/**
    A color [literal](#highlight.tags.literal).
    */
		color: t( literal ),
		/**
    A URL [literal](#highlight.tags.literal).
    */
		url: t( literal ),
		/**
    A language keyword.
    */
		keyword,
		/**
    The [keyword](#highlight.tags.keyword) for the self or this
    object.
    */
		self: t( keyword ),
		/**
    The [keyword](#highlight.tags.keyword) for null.
    */
		null: t( keyword ),
		/**
    A [keyword](#highlight.tags.keyword) denoting some atomic value.
    */
		atom: t( keyword ),
		/**
    A [keyword](#highlight.tags.keyword) that represents a unit.
    */
		unit: t( keyword ),
		/**
    A modifier [keyword](#highlight.tags.keyword).
    */
		modifier: t( keyword ),
		/**
    A [keyword](#highlight.tags.keyword) that acts as an operator.
    */
		operatorKeyword: t( keyword ),
		/**
    A control-flow related [keyword](#highlight.tags.keyword).
    */
		controlKeyword: t( keyword ),
		/**
    A [keyword](#highlight.tags.keyword) that defines something.
    */
		definitionKeyword: t( keyword ),
		/**
    A [keyword](#highlight.tags.keyword) related to defining or
    interfacing with modules.
    */
		moduleKeyword: t( keyword ),
		/**
    An operator.
    */
		operator,
		/**
    An [operator](#highlight.tags.operator) that dereferences something.
    */
		derefOperator: t( operator ),
		/**
    Arithmetic-related [operator](#highlight.tags.operator).
    */
		arithmeticOperator: t( operator ),
		/**
    Logical [operator](#highlight.tags.operator).
    */
		logicOperator: t( operator ),
		/**
    Bit [operator](#highlight.tags.operator).
    */
		bitwiseOperator: t( operator ),
		/**
    Comparison [operator](#highlight.tags.operator).
    */
		compareOperator: t( operator ),
		/**
    [Operator](#highlight.tags.operator) that updates its operand.
    */
		updateOperator: t( operator ),
		/**
    [Operator](#highlight.tags.operator) that defines something.
    */
		definitionOperator: t( operator ),
		/**
    Type-related [operator](#highlight.tags.operator).
    */
		typeOperator: t( operator ),
		/**
    Control-flow [operator](#highlight.tags.operator).
    */
		controlOperator: t( operator ),
		/**
    Program or markup punctuation.
    */
		punctuation,
		/**
    [Punctuation](#highlight.tags.punctuation) that separates
    things.
    */
		separator: t( punctuation ),
		/**
    Bracket-style [punctuation](#highlight.tags.punctuation).
    */
		bracket,
		/**
    Angle [brackets](#highlight.tags.bracket) (usually `<` and `>`
    tokens).
    */
		angleBracket: t( bracket ),
		/**
    Square [brackets](#highlight.tags.bracket) (usually `[` and `]`
    tokens).
    */
		squareBracket: t( bracket ),
		/**
    Parentheses (usually `(` and `)` tokens). Subtag of
    [bracket](#highlight.tags.bracket).
    */
		paren: t( bracket ),
		/**
    Braces (usually `{` and `}` tokens). Subtag of
    [bracket](#highlight.tags.bracket).
    */
		brace: t( bracket ),
		/**
    Content, for example plain text in XML or markup documents.
    */
		content,
		/**
    [Content](#highlight.tags.content) that represents a heading.
    */
		heading,
		/**
    A level 1 [heading](#highlight.tags.heading).
    */
		heading1: t( heading ),
		/**
    A level 2 [heading](#highlight.tags.heading).
    */
		heading2: t( heading ),
		/**
    A level 3 [heading](#highlight.tags.heading).
    */
		heading3: t( heading ),
		/**
    A level 4 [heading](#highlight.tags.heading).
    */
		heading4: t( heading ),
		/**
    A level 5 [heading](#highlight.tags.heading).
    */
		heading5: t( heading ),
		/**
    A level 6 [heading](#highlight.tags.heading).
    */
		heading6: t( heading ),
		/**
    A prose [content](#highlight.tags.content) separator (such as a horizontal rule).
    */
		contentSeparator: t( content ),
		/**
    [Content](#highlight.tags.content) that represents a list.
    */
		list: t( content ),
		/**
    [Content](#highlight.tags.content) that represents a quote.
    */
		quote: t( content ),
		/**
    [Content](#highlight.tags.content) that is emphasized.
    */
		emphasis: t( content ),
		/**
    [Content](#highlight.tags.content) that is styled strong.
    */
		strong: t( content ),
		/**
    [Content](#highlight.tags.content) that is part of a link.
    */
		link: t( content ),
		/**
    [Content](#highlight.tags.content) that is styled as code or
    monospace.
    */
		monospace: t( content ),
		/**
    [Content](#highlight.tags.content) that has a strike-through
    style.
    */
		strikethrough: t( content ),
		/**
    Inserted text in a change-tracking format.
    */
		inserted: t(),
		/**
    Deleted text.
    */
		deleted: t(),
		/**
    Changed text.
    */
		changed: t(),
		/**
    An invalid or unsyntactic element.
    */
		invalid: t(),
		/**
    Metadata or meta-instruction.
    */
		meta,
		/**
    [Metadata](#highlight.tags.meta) that applies to the entire
    document.
    */
		documentMeta: t( meta ),
		/**
    [Metadata](#highlight.tags.meta) that annotates or adds
    attributes to a given syntactic element.
    */
		annotation: t( meta ),
		/**
    Processing instruction or preprocessor directive. Subtag of
    [meta](#highlight.tags.meta).
    */
		processingInstruction: t( meta ),
		/**
    [Modifier](#highlight.Tag^defineModifier) that indicates that a
    given element is being defined. Expected to be used with the
    various [name](#highlight.tags.name) tags.
    */
		definition: Tag.defineModifier( 'definition' ),
		/**
    [Modifier](#highlight.Tag^defineModifier) that indicates that
    something is constant. Mostly expected to be used with
    [variable names](#highlight.tags.variableName).
    */
		constant: Tag.defineModifier( 'constant' ),
		/**
    [Modifier](#highlight.Tag^defineModifier) used to indicate that
    a [variable](#highlight.tags.variableName) or [property
    name](#highlight.tags.propertyName) is being called or defined
    as a function.
    */
		function: Tag.defineModifier( 'function' ),
		/**
    [Modifier](#highlight.Tag^defineModifier) that can be applied to
    [names](#highlight.tags.name) to indicate that they belong to
    the language's standard environment.
    */
		standard: Tag.defineModifier( 'standard' ),
		/**
    [Modifier](#highlight.Tag^defineModifier) that indicates a given
    [names](#highlight.tags.name) is local to some scope.
    */
		local: Tag.defineModifier( 'local' ),
		/**
    A generic variant [modifier](#highlight.Tag^defineModifier) that
    can be used to tag language-specific alternative variants of
    some common tag. It is recommended for themes to define special
    forms of at least the [string](#highlight.tags.string) and
    [variable name](#highlight.tags.variableName) tags, since those
    come up a lot.
    */
		special: Tag.defineModifier( 'special' ),
	};
	for ( let name2 in tags ) {
		let val = tags[ name2 ];
		if ( val instanceof Tag ) val.name = name2;
	}
	tagHighlighter( [
		{ tag: tags.link, class: 'tok-link' },
		{ tag: tags.heading, class: 'tok-heading' },
		{ tag: tags.emphasis, class: 'tok-emphasis' },
		{ tag: tags.strong, class: 'tok-strong' },
		{ tag: tags.keyword, class: 'tok-keyword' },
		{ tag: tags.atom, class: 'tok-atom' },
		{ tag: tags.bool, class: 'tok-bool' },
		{ tag: tags.url, class: 'tok-url' },
		{ tag: tags.labelName, class: 'tok-labelName' },
		{ tag: tags.inserted, class: 'tok-inserted' },
		{ tag: tags.deleted, class: 'tok-deleted' },
		{ tag: tags.literal, class: 'tok-literal' },
		{ tag: tags.string, class: 'tok-string' },
		{ tag: tags.number, class: 'tok-number' },
		{
			tag: [ tags.regexp, tags.escape, tags.special( tags.string ) ],
			class: 'tok-string2',
		},
		{ tag: tags.variableName, class: 'tok-variableName' },
		{
			tag: tags.local( tags.variableName ),
			class: 'tok-variableName tok-local',
		},
		{
			tag: tags.definition( tags.variableName ),
			class: 'tok-variableName tok-definition',
		},
		{ tag: tags.special( tags.variableName ), class: 'tok-variableName2' },
		{
			tag: tags.definition( tags.propertyName ),
			class: 'tok-propertyName tok-definition',
		},
		{ tag: tags.typeName, class: 'tok-typeName' },
		{ tag: tags.namespace, class: 'tok-namespace' },
		{ tag: tags.className, class: 'tok-className' },
		{ tag: tags.macroName, class: 'tok-macroName' },
		{ tag: tags.propertyName, class: 'tok-propertyName' },
		{ tag: tags.operator, class: 'tok-operator' },
		{ tag: tags.comment, class: 'tok-comment' },
		{ tag: tags.meta, class: 'tok-meta' },
		{ tag: tags.invalid, class: 'tok-invalid' },
		{ tag: tags.punctuation, class: 'tok-punctuation' },
	] );
	class Stack {
		/**
    @internal
    */
		constructor(
			p,
			stack,
			state,
			reducePos,
			pos,
			score,
			buffer,
			bufferBase,
			curContext,
			lookAhead = 0,
			parent
		) {
			this.p = p;
			this.stack = stack;
			this.state = state;
			this.reducePos = reducePos;
			this.pos = pos;
			this.score = score;
			this.buffer = buffer;
			this.bufferBase = bufferBase;
			this.curContext = curContext;
			this.lookAhead = lookAhead;
			this.parent = parent;
		}
		/**
    @internal
    */
		toString() {
			return `[${ this.stack
				.filter( ( _, i ) => i % 3 == 0 )
				.concat( this.state ) }]@${ this.pos }${
				this.score ? '!' + this.score : ''
			}`;
		}
		// Start an empty stack
		/**
    @internal
    */
		static start( p, state, pos = 0 ) {
			let cx = p.parser.context;
			return new Stack(
				p,
				[],
				state,
				pos,
				pos,
				0,
				[],
				0,
				cx ? new StackContext( cx, cx.start ) : null,
				0,
				null
			);
		}
		/**
    The stack's current [context](#lr.ContextTracker) value, if
    any. Its type will depend on the context tracker's type
    parameter, or it will be `null` if there is no context
    tracker.
    */
		get context() {
			return this.curContext ? this.curContext.context : null;
		}
		// Push a state onto the stack, tracking its start position as well
		// as the buffer base at that point.
		/**
    @internal
    */
		pushState( state, start ) {
			this.stack.push(
				this.state,
				start,
				this.bufferBase + this.buffer.length
			);
			this.state = state;
		}
		// Apply a reduce action
		/**
    @internal
    */
		reduce( action ) {
			var _a;
			let depth = action >> 19,
				type = action & 65535;
			let { parser: parser2 } = this.p;
			let lookaheadRecord = this.reducePos < this.pos - 25;
			if ( lookaheadRecord ) this.setLookAhead( this.pos );
			let dPrec = parser2.dynamicPrecedence( type );
			if ( dPrec ) this.score += dPrec;
			if ( depth == 0 ) {
				this.pushState(
					parser2.getGoto( this.state, type, true ),
					this.reducePos
				);
				if ( type < parser2.minRepeatTerm )
					this.storeNode(
						type,
						this.reducePos,
						this.reducePos,
						lookaheadRecord ? 8 : 4,
						true
					);
				this.reduceContext( type, this.reducePos );
				return;
			}
			let base =
				this.stack.length -
				( depth - 1 ) * 3 -
				( action & 262144 ? 6 : 0 );
			let start = base ? this.stack[ base - 2 ] : this.p.ranges[ 0 ].from,
				size = this.reducePos - start;
			if (
				size >= 2e3 &&
				! ( ( _a = this.p.parser.nodeSet.types[ type ] ) === null ||
				_a === void 0
					? void 0
					: _a.isAnonymous )
			) {
				if ( start == this.p.lastBigReductionStart ) {
					this.p.bigReductionCount++;
					this.p.lastBigReductionSize = size;
				} else if ( this.p.lastBigReductionSize < size ) {
					this.p.bigReductionCount = 1;
					this.p.lastBigReductionStart = start;
					this.p.lastBigReductionSize = size;
				}
			}
			let bufferBase = base ? this.stack[ base - 1 ] : 0,
				count = this.bufferBase + this.buffer.length - bufferBase;
			if ( type < parser2.minRepeatTerm || action & 131072 ) {
				let pos = parser2.stateFlag(
					this.state,
					1
					/* StateFlag.Skipped */
				)
					? this.pos
					: this.reducePos;
				this.storeNode( type, start, pos, count + 4, true );
			}
			if ( action & 262144 ) {
				this.state = this.stack[ base ];
			} else {
				let baseStateID = this.stack[ base - 3 ];
				this.state = parser2.getGoto( baseStateID, type, true );
			}
			while ( this.stack.length > base ) this.stack.pop();
			this.reduceContext( type, start );
		}
		// Shift a value into the buffer
		/**
    @internal
    */
		storeNode( term, start, end, size = 4, mustSink = false ) {
			if (
				term == 0 &&
				( ! this.stack.length ||
					this.stack[ this.stack.length - 1 ] <
						this.buffer.length + this.bufferBase )
			) {
				let cur = this,
					top = this.buffer.length;
				if ( top == 0 && cur.parent ) {
					top = cur.bufferBase - cur.parent.bufferBase;
					cur = cur.parent;
				}
				if (
					top > 0 &&
					cur.buffer[ top - 4 ] == 0 &&
					cur.buffer[ top - 1 ] > -1
				) {
					if ( start == end ) return;
					if ( cur.buffer[ top - 2 ] >= start ) {
						cur.buffer[ top - 2 ] = end;
						return;
					}
				}
			}
			if ( ! mustSink || this.pos == end ) {
				this.buffer.push( term, start, end, size );
			} else {
				let index = this.buffer.length;
				if ( index > 0 && this.buffer[ index - 4 ] != 0 ) {
					let mustMove = false;
					for (
						let scan = index;
						scan > 0 && this.buffer[ scan - 2 ] > end;
						scan -= 4
					) {
						if ( this.buffer[ scan - 1 ] >= 0 ) {
							mustMove = true;
							break;
						}
					}
					if ( mustMove )
						while ( index > 0 && this.buffer[ index - 2 ] > end ) {
							this.buffer[ index ] = this.buffer[ index - 4 ];
							this.buffer[ index + 1 ] = this.buffer[ index - 3 ];
							this.buffer[ index + 2 ] = this.buffer[ index - 2 ];
							this.buffer[ index + 3 ] = this.buffer[ index - 1 ];
							index -= 4;
							if ( size > 4 ) size -= 4;
						}
				}
				this.buffer[ index ] = term;
				this.buffer[ index + 1 ] = start;
				this.buffer[ index + 2 ] = end;
				this.buffer[ index + 3 ] = size;
			}
		}
		// Apply a shift action
		/**
    @internal
    */
		shift( action, type, start, end ) {
			if ( action & 131072 ) {
				this.pushState( action & 65535, this.pos );
			} else if ( ( action & 262144 ) == 0 ) {
				let nextState = action,
					{ parser: parser2 } = this.p;
				if ( end > this.pos || type <= parser2.maxNode ) {
					this.pos = end;
					if (
						! parser2.stateFlag(
							nextState,
							1
							/* StateFlag.Skipped */
						)
					)
						this.reducePos = end;
				}
				this.pushState( nextState, start );
				this.shiftContext( type, start );
				if ( type <= parser2.maxNode )
					this.buffer.push( type, start, end, 4 );
			} else {
				this.pos = end;
				this.shiftContext( type, start );
				if ( type <= this.p.parser.maxNode )
					this.buffer.push( type, start, end, 4 );
			}
		}
		// Apply an action
		/**
    @internal
    */
		apply( action, next, nextStart, nextEnd ) {
			if ( action & 65536 ) this.reduce( action );
			else this.shift( action, next, nextStart, nextEnd );
		}
		// Add a prebuilt (reused) node into the buffer.
		/**
    @internal
    */
		useNode( value, next ) {
			let index = this.p.reused.length - 1;
			if ( index < 0 || this.p.reused[ index ] != value ) {
				this.p.reused.push( value );
				index++;
			}
			let start = this.pos;
			this.reducePos = this.pos = start + value.length;
			this.pushState( next, start );
			this.buffer.push(
				index,
				start,
				this.reducePos,
				-1
				/* size == -1 means this is a reused value */
			);
			if ( this.curContext )
				this.updateContext(
					this.curContext.tracker.reuse(
						this.curContext.context,
						value,
						this,
						this.p.stream.reset( this.pos - value.length )
					)
				);
		}
		// Split the stack. Due to the buffer sharing and the fact
		// that `this.stack` tends to stay quite shallow, this isn't very
		// expensive.
		/**
    @internal
    */
		split() {
			let parent = this;
			let off = parent.buffer.length;
			while ( off > 0 && parent.buffer[ off - 2 ] > parent.reducePos )
				off -= 4;
			let buffer = parent.buffer.slice( off ),
				base = parent.bufferBase + off;
			while ( parent && base == parent.bufferBase )
				parent = parent.parent;
			return new Stack(
				this.p,
				this.stack.slice(),
				this.state,
				this.reducePos,
				this.pos,
				this.score,
				buffer,
				base,
				this.curContext,
				this.lookAhead,
				parent
			);
		}
		// Try to recover from an error by 'deleting' (ignoring) one token.
		/**
    @internal
    */
		recoverByDelete( next, nextEnd ) {
			let isNode = next <= this.p.parser.maxNode;
			if ( isNode ) this.storeNode( next, this.pos, nextEnd, 4 );
			this.storeNode( 0, this.pos, nextEnd, isNode ? 8 : 4 );
			this.pos = this.reducePos = nextEnd;
			this.score -= 190;
		}
		/**
    Check if the given term would be able to be shifted (optionally
    after some reductions) on this stack. This can be useful for
    external tokenizers that want to make sure they only provide a
    given token when it applies.
    */
		canShift( term ) {
			for ( let sim = new SimulatedStack( this ); ;  ) {
				let action =
					this.p.parser.stateSlot(
						sim.state,
						4
						/* ParseState.DefaultReduce */
					) || this.p.parser.hasAction( sim.state, term );
				if ( action == 0 ) return false;
				if ( ( action & 65536 ) == 0 ) return true;
				sim.reduce( action );
			}
		}
		// Apply up to Recover.MaxNext recovery actions that conceptually
		// inserts some missing token or rule.
		/**
    @internal
    */
		recoverByInsert( next ) {
			if ( this.stack.length >= 300 ) return [];
			let nextStates = this.p.parser.nextStates( this.state );
			if ( nextStates.length > 4 << 1 || this.stack.length >= 120 ) {
				let best = [];
				for ( let i = 0, s; i < nextStates.length; i += 2 ) {
					if (
						( s = nextStates[ i + 1 ] ) != this.state &&
						this.p.parser.hasAction( s, next )
					)
						best.push( nextStates[ i ], s );
				}
				if ( this.stack.length < 120 )
					for (
						let i = 0;
						best.length < 4 << 1 && i < nextStates.length;
						i += 2
					) {
						let s = nextStates[ i + 1 ];
						if ( ! best.some( ( v, i2 ) => i2 & 1 && v == s ) )
							best.push( nextStates[ i ], s );
					}
				nextStates = best;
			}
			let result = [];
			for (
				let i = 0;
				i < nextStates.length && result.length < 4;
				i += 2
			) {
				let s = nextStates[ i + 1 ];
				if ( s == this.state ) continue;
				let stack = this.split();
				stack.pushState( s, this.pos );
				stack.storeNode( 0, stack.pos, stack.pos, 4, true );
				stack.shiftContext( nextStates[ i ], this.pos );
				stack.reducePos = this.pos;
				stack.score -= 200;
				result.push( stack );
			}
			return result;
		}
		// Force a reduce, if possible. Return false if that can't
		// be done.
		/**
    @internal
    */
		forceReduce() {
			let { parser: parser2 } = this.p;
			let reduce = parser2.stateSlot(
				this.state,
				5
				/* ParseState.ForcedReduce */
			);
			if ( ( reduce & 65536 ) == 0 ) return false;
			if ( ! parser2.validAction( this.state, reduce ) ) {
				let depth = reduce >> 19,
					term = reduce & 65535;
				let target = this.stack.length - depth * 3;
				if (
					target < 0 ||
					parser2.getGoto( this.stack[ target ], term, false ) < 0
				) {
					let backup = this.findForcedReduction();
					if ( backup == null ) return false;
					reduce = backup;
				}
				this.storeNode( 0, this.pos, this.pos, 4, true );
				this.score -= 100;
			}
			this.reducePos = this.pos;
			this.reduce( reduce );
			return true;
		}
		/**
    Try to scan through the automaton to find some kind of reduction
    that can be applied. Used when the regular ForcedReduce field
    isn't a valid action. @internal
    */
		findForcedReduction() {
			let { parser: parser2 } = this.p,
				seen = [];
			let explore = ( state, depth ) => {
				if ( seen.includes( state ) ) return;
				seen.push( state );
				return parser2.allActions( state, ( action ) => {
					if ( action & ( 262144 | 131072 ) );
					else if ( action & 65536 ) {
						let rDepth = ( action >> 19 ) - depth;
						if ( rDepth > 1 ) {
							let term = action & 65535,
								target = this.stack.length - rDepth * 3;
							if (
								target >= 0 &&
								parser2.getGoto(
									this.stack[ target ],
									term,
									false
								) >= 0
							)
								return ( rDepth << 19 ) | 65536 | term;
						}
					} else {
						let found = explore( action, depth + 1 );
						if ( found != null ) return found;
					}
				} );
			};
			return explore( this.state, 0 );
		}
		/**
    @internal
    */
		forceAll() {
			while (
				! this.p.parser.stateFlag(
					this.state,
					2
					/* StateFlag.Accepting */
				)
			) {
				if ( ! this.forceReduce() ) {
					this.storeNode( 0, this.pos, this.pos, 4, true );
					break;
				}
			}
			return this;
		}
		/**
    Check whether this state has no further actions (assumed to be a direct descendant of the
    top state, since any other states must be able to continue
    somehow). @internal
    */
		get deadEnd() {
			if ( this.stack.length != 3 ) return false;
			let { parser: parser2 } = this.p;
			return (
				parser2.data[
					parser2.stateSlot(
						this.state,
						1
						/* ParseState.Actions */
					)
				] == 65535 &&
				! parser2.stateSlot(
					this.state,
					4
					/* ParseState.DefaultReduce */
				)
			);
		}
		/**
    Restart the stack (put it back in its start state). Only safe
    when this.stack.length == 3 (state is directly below the top
    state). @internal
    */
		restart() {
			this.storeNode( 0, this.pos, this.pos, 4, true );
			this.state = this.stack[ 0 ];
			this.stack.length = 0;
		}
		/**
    @internal
    */
		sameState( other ) {
			if (
				this.state != other.state ||
				this.stack.length != other.stack.length
			)
				return false;
			for ( let i = 0; i < this.stack.length; i += 3 )
				if ( this.stack[ i ] != other.stack[ i ] ) return false;
			return true;
		}
		/**
    Get the parser used by this stack.
    */
		get parser() {
			return this.p.parser;
		}
		/**
    Test whether a given dialect (by numeric ID, as exported from
    the terms file) is enabled.
    */
		dialectEnabled( dialectID ) {
			return this.p.parser.dialect.flags[ dialectID ];
		}
		shiftContext( term, start ) {
			if ( this.curContext )
				this.updateContext(
					this.curContext.tracker.shift(
						this.curContext.context,
						term,
						this,
						this.p.stream.reset( start )
					)
				);
		}
		reduceContext( term, start ) {
			if ( this.curContext )
				this.updateContext(
					this.curContext.tracker.reduce(
						this.curContext.context,
						term,
						this,
						this.p.stream.reset( start )
					)
				);
		}
		/**
    @internal
    */
		emitContext() {
			let last = this.buffer.length - 1;
			if ( last < 0 || this.buffer[ last ] != -3 )
				this.buffer.push(
					this.curContext.hash,
					this.pos,
					this.pos,
					-3
				);
		}
		/**
    @internal
    */
		emitLookAhead() {
			let last = this.buffer.length - 1;
			if ( last < 0 || this.buffer[ last ] != -4 )
				this.buffer.push( this.lookAhead, this.pos, this.pos, -4 );
		}
		updateContext( context ) {
			if ( context != this.curContext.context ) {
				let newCx = new StackContext(
					this.curContext.tracker,
					context
				);
				if ( newCx.hash != this.curContext.hash ) this.emitContext();
				this.curContext = newCx;
			}
		}
		/**
    @internal
    */
		setLookAhead( lookAhead ) {
			if ( lookAhead > this.lookAhead ) {
				this.emitLookAhead();
				this.lookAhead = lookAhead;
			}
		}
		/**
    @internal
    */
		close() {
			if ( this.curContext && this.curContext.tracker.strict )
				this.emitContext();
			if ( this.lookAhead > 0 ) this.emitLookAhead();
		}
	}
	class StackContext {
		constructor( tracker, context ) {
			this.tracker = tracker;
			this.context = context;
			this.hash = tracker.strict ? tracker.hash( context ) : 0;
		}
	}
	class SimulatedStack {
		constructor( start ) {
			this.start = start;
			this.state = start.state;
			this.stack = start.stack;
			this.base = this.stack.length;
		}
		reduce( action ) {
			let term = action & 65535,
				depth = action >> 19;
			if ( depth == 0 ) {
				if ( this.stack == this.start.stack )
					this.stack = this.stack.slice();
				this.stack.push( this.state, 0, 0 );
				this.base += 3;
			} else {
				this.base -= ( depth - 1 ) * 3;
			}
			let goto = this.start.p.parser.getGoto(
				this.stack[ this.base - 3 ],
				term,
				true
			);
			this.state = goto;
		}
	}
	class StackBufferCursor {
		constructor( stack, pos, index ) {
			this.stack = stack;
			this.pos = pos;
			this.index = index;
			this.buffer = stack.buffer;
			if ( this.index == 0 ) this.maybeNext();
		}
		static create( stack, pos = stack.bufferBase + stack.buffer.length ) {
			return new StackBufferCursor( stack, pos, pos - stack.bufferBase );
		}
		maybeNext() {
			let next = this.stack.parent;
			if ( next != null ) {
				this.index = this.stack.bufferBase - next.bufferBase;
				this.stack = next;
				this.buffer = next.buffer;
			}
		}
		get id() {
			return this.buffer[ this.index - 4 ];
		}
		get start() {
			return this.buffer[ this.index - 3 ];
		}
		get end() {
			return this.buffer[ this.index - 2 ];
		}
		get size() {
			return this.buffer[ this.index - 1 ];
		}
		next() {
			this.index -= 4;
			this.pos -= 4;
			if ( this.index == 0 ) this.maybeNext();
		}
		fork() {
			return new StackBufferCursor( this.stack, this.pos, this.index );
		}
	}
	function decodeArray( input, Type = Uint16Array ) {
		if ( typeof input != 'string' ) return input;
		let array = null;
		for ( let pos = 0, out = 0; pos < input.length;  ) {
			let value = 0;
			for (;;) {
				let next = input.charCodeAt( pos++ ),
					stop = false;
				if ( next == 126 ) {
					value = 65535;
					break;
				}
				if ( next >= 92 ) next--;
				if ( next >= 34 ) next--;
				let digit = next - 32;
				if ( digit >= 46 ) {
					digit -= 46;
					stop = true;
				}
				value += digit;
				if ( stop ) break;
				value *= 46;
			}
			if ( array ) array[ out++ ] = value;
			else array = new Type( value );
		}
		return array;
	}
	class CachedToken {
		constructor() {
			this.start = -1;
			this.value = -1;
			this.end = -1;
			this.extended = -1;
			this.lookAhead = 0;
			this.mask = 0;
			this.context = 0;
		}
	}
	const nullToken = new CachedToken();
	class InputStream {
		/**
    @internal
    */
		constructor( input, ranges ) {
			this.input = input;
			this.ranges = ranges;
			this.chunk = '';
			this.chunkOff = 0;
			this.chunk2 = '';
			this.chunk2Pos = 0;
			this.next = -1;
			this.token = nullToken;
			this.rangeIndex = 0;
			this.pos = this.chunkPos = ranges[ 0 ].from;
			this.range = ranges[ 0 ];
			this.end = ranges[ ranges.length - 1 ].to;
			this.readNext();
		}
		/**
    @internal
    */
		resolveOffset( offset, assoc ) {
			let range = this.range,
				index = this.rangeIndex;
			let pos = this.pos + offset;
			while ( pos < range.from ) {
				if ( ! index ) return null;
				let next = this.ranges[ --index ];
				pos -= range.from - next.to;
				range = next;
			}
			while ( assoc < 0 ? pos > range.to : pos >= range.to ) {
				if ( index == this.ranges.length - 1 ) return null;
				let next = this.ranges[ ++index ];
				pos += next.from - range.to;
				range = next;
			}
			return pos;
		}
		/**
    @internal
    */
		clipPos( pos ) {
			if ( pos >= this.range.from && pos < this.range.to ) return pos;
			for ( let range of this.ranges )
				if ( range.to > pos ) return Math.max( pos, range.from );
			return this.end;
		}
		/**
    Look at a code unit near the stream position. `.peek(0)` equals
    `.next`, `.peek(-1)` gives you the previous character, and so
    on.
    
    Note that looking around during tokenizing creates dependencies
    on potentially far-away content, which may reduce the
    effectiveness incremental parsing—when looking forward—or even
    cause invalid reparses when looking backward more than 25 code
    units, since the library does not track lookbehind.
    */
		peek( offset ) {
			let idx = this.chunkOff + offset,
				pos,
				result;
			if ( idx >= 0 && idx < this.chunk.length ) {
				pos = this.pos + offset;
				result = this.chunk.charCodeAt( idx );
			} else {
				let resolved = this.resolveOffset( offset, 1 );
				if ( resolved == null ) return -1;
				pos = resolved;
				if (
					pos >= this.chunk2Pos &&
					pos < this.chunk2Pos + this.chunk2.length
				) {
					result = this.chunk2.charCodeAt( pos - this.chunk2Pos );
				} else {
					let i = this.rangeIndex,
						range = this.range;
					while ( range.to <= pos ) range = this.ranges[ ++i ];
					this.chunk2 = this.input.chunk( ( this.chunk2Pos = pos ) );
					if ( pos + this.chunk2.length > range.to )
						this.chunk2 = this.chunk2.slice( 0, range.to - pos );
					result = this.chunk2.charCodeAt( 0 );
				}
			}
			if ( pos >= this.token.lookAhead ) this.token.lookAhead = pos + 1;
			return result;
		}
		/**
    Accept a token. By default, the end of the token is set to the
    current stream position, but you can pass an offset (relative to
    the stream position) to change that.
    */
		acceptToken( token, endOffset = 0 ) {
			let end = endOffset
				? this.resolveOffset( endOffset, -1 )
				: this.pos;
			if ( end == null || end < this.token.start )
				throw new RangeError( 'Token end out of bounds' );
			this.token.value = token;
			this.token.end = end;
		}
		/**
    Accept a token ending at a specific given position.
    */
		acceptTokenTo( token, endPos ) {
			this.token.value = token;
			this.token.end = endPos;
		}
		getChunk() {
			if (
				this.pos >= this.chunk2Pos &&
				this.pos < this.chunk2Pos + this.chunk2.length
			) {
				let { chunk, chunkPos } = this;
				this.chunk = this.chunk2;
				this.chunkPos = this.chunk2Pos;
				this.chunk2 = chunk;
				this.chunk2Pos = chunkPos;
				this.chunkOff = this.pos - this.chunkPos;
			} else {
				this.chunk2 = this.chunk;
				this.chunk2Pos = this.chunkPos;
				let nextChunk = this.input.chunk( this.pos );
				let end = this.pos + nextChunk.length;
				this.chunk =
					end > this.range.to
						? nextChunk.slice( 0, this.range.to - this.pos )
						: nextChunk;
				this.chunkPos = this.pos;
				this.chunkOff = 0;
			}
		}
		readNext() {
			if ( this.chunkOff >= this.chunk.length ) {
				this.getChunk();
				if ( this.chunkOff == this.chunk.length )
					return ( this.next = -1 );
			}
			return ( this.next = this.chunk.charCodeAt( this.chunkOff ) );
		}
		/**
    Move the stream forward N (defaults to 1) code units. Returns
    the new value of [`next`](#lr.InputStream.next).
    */
		advance( n = 1 ) {
			this.chunkOff += n;
			while ( this.pos + n >= this.range.to ) {
				if ( this.rangeIndex == this.ranges.length - 1 )
					return this.setDone();
				n -= this.range.to - this.pos;
				this.range = this.ranges[ ++this.rangeIndex ];
				this.pos = this.range.from;
			}
			this.pos += n;
			if ( this.pos >= this.token.lookAhead )
				this.token.lookAhead = this.pos + 1;
			return this.readNext();
		}
		setDone() {
			this.pos = this.chunkPos = this.end;
			this.range =
				this.ranges[ ( this.rangeIndex = this.ranges.length - 1 ) ];
			this.chunk = '';
			return ( this.next = -1 );
		}
		/**
    @internal
    */
		reset( pos, token ) {
			if ( token ) {
				this.token = token;
				token.start = pos;
				token.lookAhead = pos + 1;
				token.value = token.extended = -1;
			} else {
				this.token = nullToken;
			}
			if ( this.pos != pos ) {
				this.pos = pos;
				if ( pos == this.end ) {
					this.setDone();
					return this;
				}
				while ( pos < this.range.from )
					this.range = this.ranges[ --this.rangeIndex ];
				while ( pos >= this.range.to )
					this.range = this.ranges[ ++this.rangeIndex ];
				if (
					pos >= this.chunkPos &&
					pos < this.chunkPos + this.chunk.length
				) {
					this.chunkOff = pos - this.chunkPos;
				} else {
					this.chunk = '';
					this.chunkOff = 0;
				}
				this.readNext();
			}
			return this;
		}
		/**
    @internal
    */
		read( from, to ) {
			if (
				from >= this.chunkPos &&
				to <= this.chunkPos + this.chunk.length
			)
				return this.chunk.slice(
					from - this.chunkPos,
					to - this.chunkPos
				);
			if (
				from >= this.chunk2Pos &&
				to <= this.chunk2Pos + this.chunk2.length
			)
				return this.chunk2.slice(
					from - this.chunk2Pos,
					to - this.chunk2Pos
				);
			if ( from >= this.range.from && to <= this.range.to )
				return this.input.read( from, to );
			let result = '';
			for ( let r of this.ranges ) {
				if ( r.from >= to ) break;
				if ( r.to > from )
					result += this.input.read(
						Math.max( r.from, from ),
						Math.min( r.to, to )
					);
			}
			return result;
		}
	}
	class TokenGroup {
		constructor( data, id ) {
			this.data = data;
			this.id = id;
		}
		token( input, stack ) {
			let { parser: parser2 } = stack.p;
			readToken(
				this.data,
				input,
				stack,
				this.id,
				parser2.data,
				parser2.tokenPrecTable
			);
		}
	}
	TokenGroup.prototype.contextual =
		TokenGroup.prototype.fallback =
		TokenGroup.prototype.extend =
			false;
	TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
	function readToken( data, input, stack, group, precTable, precOffset ) {
		let state = 0,
			groupMask = 1 << group,
			{ dialect } = stack.p.parser;
		scan: for (;;) {
			if ( ( groupMask & data[ state ] ) == 0 ) break;
			let accEnd = data[ state + 1 ];
			for ( let i = state + 3; i < accEnd; i += 2 )
				if ( ( data[ i + 1 ] & groupMask ) > 0 ) {
					let term = data[ i ];
					if (
						dialect.allows( term ) &&
						( input.token.value == -1 ||
							input.token.value == term ||
							overrides(
								term,
								input.token.value,
								precTable,
								precOffset
							) )
					) {
						input.acceptToken( term );
						break;
					}
				}
			let next = input.next,
				low = 0,
				high = data[ state + 2 ];
			if (
				input.next < 0 &&
				high > low &&
				data[ accEnd + high * 3 - 3 ] == 65535
			) {
				state = data[ accEnd + high * 3 - 1 ];
				continue scan;
			}
			for ( ; low < high;  ) {
				let mid = ( low + high ) >> 1;
				let index = accEnd + mid + ( mid << 1 );
				let from = data[ index ],
					to = data[ index + 1 ] || 65536;
				if ( next < from ) high = mid;
				else if ( next >= to ) low = mid + 1;
				else {
					state = data[ index + 2 ];
					input.advance();
					continue scan;
				}
			}
			break;
		}
	}
	function findOffset( data, start, term ) {
		for ( let i = start, next; ( next = data[ i ] ) != 65535; i++ )
			if ( next == term ) return i - start;
		return -1;
	}
	function overrides( token, prev, tableData, tableOffset ) {
		let iPrev = findOffset( tableData, tableOffset, prev );
		return iPrev < 0 || findOffset( tableData, tableOffset, token ) < iPrev;
	}
	const verbose =
		typeof process != 'undefined' &&
		process.env &&
		/\bparse\b/.test( process.env.LOG );
	let stackIDs = null;
	function cutAt( tree, pos, side ) {
		let cursor = tree.cursor( IterMode.IncludeAnonymous );
		cursor.moveTo( pos );
		for (;;) {
			if (
				! ( side < 0
					? cursor.childBefore( pos )
					: cursor.childAfter( pos ) )
			)
				for (;;) {
					if (
						( side < 0 ? cursor.to < pos : cursor.from > pos ) &&
						! cursor.type.isError
					)
						return side < 0
							? Math.max(
									0,
									Math.min(
										cursor.to - 1,
										pos - 25
										/* Lookahead.Margin */
									)
							  )
							: Math.min(
									tree.length,
									Math.max(
										cursor.from + 1,
										pos + 25
										/* Lookahead.Margin */
									)
							  );
					if (
						side < 0 ? cursor.prevSibling() : cursor.nextSibling()
					)
						break;
					if ( ! cursor.parent() ) return side < 0 ? 0 : tree.length;
				}
		}
	}
	class FragmentCursor {
		constructor( fragments, nodeSet ) {
			this.fragments = fragments;
			this.nodeSet = nodeSet;
			this.i = 0;
			this.fragment = null;
			this.safeFrom = -1;
			this.safeTo = -1;
			this.trees = [];
			this.start = [];
			this.index = [];
			this.nextFragment();
		}
		nextFragment() {
			let fr = ( this.fragment =
				this.i == this.fragments.length
					? null
					: this.fragments[ this.i++ ] );
			if ( fr ) {
				this.safeFrom = fr.openStart
					? cutAt( fr.tree, fr.from + fr.offset, 1 ) - fr.offset
					: fr.from;
				this.safeTo = fr.openEnd
					? cutAt( fr.tree, fr.to + fr.offset, -1 ) - fr.offset
					: fr.to;
				while ( this.trees.length ) {
					this.trees.pop();
					this.start.pop();
					this.index.pop();
				}
				this.trees.push( fr.tree );
				this.start.push( -fr.offset );
				this.index.push( 0 );
				this.nextStart = this.safeFrom;
			} else {
				this.nextStart = 1e9;
			}
		}
		// `pos` must be >= any previously given `pos` for this cursor
		nodeAt( pos ) {
			if ( pos < this.nextStart ) return null;
			while ( this.fragment && this.safeTo <= pos ) this.nextFragment();
			if ( ! this.fragment ) return null;
			for (;;) {
				let last = this.trees.length - 1;
				if ( last < 0 ) {
					this.nextFragment();
					return null;
				}
				let top = this.trees[ last ],
					index = this.index[ last ];
				if ( index == top.children.length ) {
					this.trees.pop();
					this.start.pop();
					this.index.pop();
					continue;
				}
				let next = top.children[ index ];
				let start = this.start[ last ] + top.positions[ index ];
				if ( start > pos ) {
					this.nextStart = start;
					return null;
				}
				if ( next instanceof Tree ) {
					if ( start == pos ) {
						if ( start < this.safeFrom ) return null;
						let end = start + next.length;
						if ( end <= this.safeTo ) {
							let lookAhead = next.prop( NodeProp.lookAhead );
							if (
								! lookAhead ||
								end + lookAhead < this.fragment.to
							)
								return next;
						}
					}
					this.index[ last ]++;
					if (
						start + next.length >=
						Math.max( this.safeFrom, pos )
					) {
						this.trees.push( next );
						this.start.push( start );
						this.index.push( 0 );
					}
				} else {
					this.index[ last ]++;
					this.nextStart = start + next.length;
				}
			}
		}
	}
	class TokenCache {
		constructor( parser2, stream ) {
			this.stream = stream;
			this.tokens = [];
			this.mainToken = null;
			this.actions = [];
			this.tokens = parser2.tokenizers.map( ( _ ) => new CachedToken() );
		}
		getActions( stack ) {
			let actionIndex = 0;
			let main = null;
			let { parser: parser2 } = stack.p,
				{ tokenizers } = parser2;
			let mask = parser2.stateSlot(
				stack.state,
				3
				/* ParseState.TokenizerMask */
			);
			let context = stack.curContext ? stack.curContext.hash : 0;
			let lookAhead = 0;
			for ( let i = 0; i < tokenizers.length; i++ ) {
				if ( ( ( 1 << i ) & mask ) == 0 ) continue;
				let tokenizer = tokenizers[ i ],
					token = this.tokens[ i ];
				if ( main && ! tokenizer.fallback ) continue;
				if (
					tokenizer.contextual ||
					token.start != stack.pos ||
					token.mask != mask ||
					token.context != context
				) {
					this.updateCachedToken( token, tokenizer, stack );
					token.mask = mask;
					token.context = context;
				}
				if ( token.lookAhead > token.end + 25 )
					lookAhead = Math.max( token.lookAhead, lookAhead );
				if ( token.value != 0 ) {
					let startIndex = actionIndex;
					if ( token.extended > -1 )
						actionIndex = this.addActions(
							stack,
							token.extended,
							token.end,
							actionIndex
						);
					actionIndex = this.addActions(
						stack,
						token.value,
						token.end,
						actionIndex
					);
					if ( ! tokenizer.extend ) {
						main = token;
						if ( actionIndex > startIndex ) break;
					}
				}
			}
			while ( this.actions.length > actionIndex ) this.actions.pop();
			if ( lookAhead ) stack.setLookAhead( lookAhead );
			if ( ! main && stack.pos == this.stream.end ) {
				main = new CachedToken();
				main.value = stack.p.parser.eofTerm;
				main.start = main.end = stack.pos;
				actionIndex = this.addActions(
					stack,
					main.value,
					main.end,
					actionIndex
				);
			}
			this.mainToken = main;
			return this.actions;
		}
		getMainToken( stack ) {
			if ( this.mainToken ) return this.mainToken;
			let main = new CachedToken(),
				{ pos, p } = stack;
			main.start = pos;
			main.end = Math.min( pos + 1, p.stream.end );
			main.value = pos == p.stream.end ? p.parser.eofTerm : 0;
			return main;
		}
		updateCachedToken( token, tokenizer, stack ) {
			let start = this.stream.clipPos( stack.pos );
			tokenizer.token( this.stream.reset( start, token ), stack );
			if ( token.value > -1 ) {
				let { parser: parser2 } = stack.p;
				for ( let i = 0; i < parser2.specialized.length; i++ )
					if ( parser2.specialized[ i ] == token.value ) {
						let result = parser2.specializers[ i ](
							this.stream.read( token.start, token.end ),
							stack
						);
						if (
							result >= 0 &&
							stack.p.parser.dialect.allows( result >> 1 )
						) {
							if ( ( result & 1 ) == 0 )
								token.value = result >> 1;
							else token.extended = result >> 1;
							break;
						}
					}
			} else {
				token.value = 0;
				token.end = this.stream.clipPos( start + 1 );
			}
		}
		putAction( action, token, end, index ) {
			for ( let i = 0; i < index; i += 3 )
				if ( this.actions[ i ] == action ) return index;
			this.actions[ index++ ] = action;
			this.actions[ index++ ] = token;
			this.actions[ index++ ] = end;
			return index;
		}
		addActions( stack, token, end, index ) {
			let { state } = stack,
				{ parser: parser2 } = stack.p,
				{ data } = parser2;
			for ( let set = 0; set < 2; set++ ) {
				for (
					let i = parser2.stateSlot(
						state,
						set ? 2 : 1
						/* ParseState.Actions */
					);
					;
					i += 3
				) {
					if ( data[ i ] == 65535 ) {
						if ( data[ i + 1 ] == 1 ) {
							i = pair( data, i + 2 );
						} else {
							if ( index == 0 && data[ i + 1 ] == 2 )
								index = this.putAction(
									pair( data, i + 2 ),
									token,
									end,
									index
								);
							break;
						}
					}
					if ( data[ i ] == token )
						index = this.putAction(
							pair( data, i + 1 ),
							token,
							end,
							index
						);
				}
			}
			return index;
		}
	}
	class Parse {
		constructor( parser2, input, fragments, ranges ) {
			this.parser = parser2;
			this.input = input;
			this.ranges = ranges;
			this.recovering = 0;
			this.nextStackID = 9812;
			this.minStackPos = 0;
			this.reused = [];
			this.stoppedAt = null;
			this.lastBigReductionStart = -1;
			this.lastBigReductionSize = 0;
			this.bigReductionCount = 0;
			this.stream = new InputStream( input, ranges );
			this.tokens = new TokenCache( parser2, this.stream );
			this.topTerm = parser2.top[ 1 ];
			let { from } = ranges[ 0 ];
			this.stacks = [ Stack.start( this, parser2.top[ 0 ], from ) ];
			this.fragments =
				fragments.length &&
				this.stream.end - from > parser2.bufferLength * 4
					? new FragmentCursor( fragments, parser2.nodeSet )
					: null;
		}
		get parsedPos() {
			return this.minStackPos;
		}
		// Move the parser forward. This will process all parse stacks at
		// `this.pos` and try to advance them to a further position. If no
		// stack for such a position is found, it'll start error-recovery.
		//
		// When the parse is finished, this will return a syntax tree. When
		// not, it returns `null`.
		advance() {
			let stacks = this.stacks,
				pos = this.minStackPos;
			let newStacks = ( this.stacks = [] );
			let stopped, stoppedTokens;
			if ( this.bigReductionCount > 300 && stacks.length == 1 ) {
				let [ s ] = stacks;
				while (
					s.forceReduce() &&
					s.stack.length &&
					s.stack[ s.stack.length - 2 ] >= this.lastBigReductionStart
				) {}
				this.bigReductionCount = this.lastBigReductionSize = 0;
			}
			for ( let i = 0; i < stacks.length; i++ ) {
				let stack = stacks[ i ];
				for (;;) {
					this.tokens.mainToken = null;
					if ( stack.pos > pos ) {
						newStacks.push( stack );
					} else if (
						this.advanceStack( stack, newStacks, stacks )
					) {
						continue;
					} else {
						if ( ! stopped ) {
							stopped = [];
							stoppedTokens = [];
						}
						stopped.push( stack );
						let tok = this.tokens.getMainToken( stack );
						stoppedTokens.push( tok.value, tok.end );
					}
					break;
				}
			}
			if ( ! newStacks.length ) {
				let finished = stopped && findFinished( stopped );
				if ( finished ) {
					if ( verbose )
						console.log(
							'Finish with ' + this.stackID( finished )
						);
					return this.stackToTree( finished );
				}
				if ( this.parser.strict ) {
					if ( verbose && stopped )
						console.log(
							'Stuck with token ' +
								( this.tokens.mainToken
									? this.parser.getName(
											this.tokens.mainToken.value
									  )
									: 'none' )
						);
					throw new SyntaxError( 'No parse at ' + pos );
				}
				if ( ! this.recovering ) this.recovering = 5;
			}
			if ( this.recovering && stopped ) {
				let finished =
					this.stoppedAt != null && stopped[ 0 ].pos > this.stoppedAt
						? stopped[ 0 ]
						: this.runRecovery( stopped, stoppedTokens, newStacks );
				if ( finished ) {
					if ( verbose )
						console.log(
							'Force-finish ' + this.stackID( finished )
						);
					return this.stackToTree( finished.forceAll() );
				}
			}
			if ( this.recovering ) {
				let maxRemaining =
					this.recovering == 1 ? 1 : this.recovering * 3;
				if ( newStacks.length > maxRemaining ) {
					newStacks.sort( ( a, b ) => b.score - a.score );
					while ( newStacks.length > maxRemaining ) newStacks.pop();
				}
				if ( newStacks.some( ( s ) => s.reducePos > pos ) )
					this.recovering--;
			} else if ( newStacks.length > 1 ) {
				outer: for ( let i = 0; i < newStacks.length - 1; i++ ) {
					let stack = newStacks[ i ];
					for ( let j = i + 1; j < newStacks.length; j++ ) {
						let other = newStacks[ j ];
						if (
							stack.sameState( other ) ||
							( stack.buffer.length > 500 &&
								other.buffer.length > 500 )
						) {
							if (
								( stack.score - other.score ||
									stack.buffer.length -
										other.buffer.length ) > 0
							) {
								newStacks.splice( j--, 1 );
							} else {
								newStacks.splice( i--, 1 );
								continue outer;
							}
						}
					}
				}
				if ( newStacks.length > 12 )
					newStacks.splice(
						12,
						newStacks.length - 12
						/* Rec.MaxStackCount */
					);
			}
			this.minStackPos = newStacks[ 0 ].pos;
			for ( let i = 1; i < newStacks.length; i++ )
				if ( newStacks[ i ].pos < this.minStackPos )
					this.minStackPos = newStacks[ i ].pos;
			return null;
		}
		stopAt( pos ) {
			if ( this.stoppedAt != null && this.stoppedAt < pos )
				throw new RangeError( "Can't move stoppedAt forward" );
			this.stoppedAt = pos;
		}
		// Returns an updated version of the given stack, or null if the
		// stack can't advance normally. When `split` and `stacks` are
		// given, stacks split off by ambiguous operations will be pushed to
		// `split`, or added to `stacks` if they move `pos` forward.
		advanceStack( stack, stacks, split ) {
			let start = stack.pos,
				{ parser: parser2 } = this;
			let base = verbose ? this.stackID( stack ) + ' -> ' : '';
			if ( this.stoppedAt != null && start > this.stoppedAt )
				return stack.forceReduce() ? stack : null;
			if ( this.fragments ) {
				let strictCx =
						stack.curContext && stack.curContext.tracker.strict,
					cxHash = strictCx ? stack.curContext.hash : 0;
				for ( let cached = this.fragments.nodeAt( start ); cached;  ) {
					let match =
						this.parser.nodeSet.types[ cached.type.id ] ==
						cached.type
							? parser2.getGoto( stack.state, cached.type.id )
							: -1;
					if (
						match > -1 &&
						cached.length &&
						( ! strictCx ||
							( cached.prop( NodeProp.contextHash ) || 0 ) ==
								cxHash )
					) {
						stack.useNode( cached, match );
						if ( verbose )
							console.log(
								base +
									this.stackID( stack ) +
									` (via reuse of ${ parser2.getName(
										cached.type.id
									) })`
							);
						return true;
					}
					if (
						! ( cached instanceof Tree ) ||
						cached.children.length == 0 ||
						cached.positions[ 0 ] > 0
					)
						break;
					let inner = cached.children[ 0 ];
					if ( inner instanceof Tree && cached.positions[ 0 ] == 0 )
						cached = inner;
					else break;
				}
			}
			let defaultReduce = parser2.stateSlot(
				stack.state,
				4
				/* ParseState.DefaultReduce */
			);
			if ( defaultReduce > 0 ) {
				stack.reduce( defaultReduce );
				if ( verbose )
					console.log(
						base +
							this.stackID( stack ) +
							` (via always-reduce ${ parser2.getName(
								defaultReduce & 65535
								/* Action.ValueMask */
							) })`
					);
				return true;
			}
			if ( stack.stack.length >= 8400 ) {
				while ( stack.stack.length > 6e3 && stack.forceReduce() ) {}
			}
			let actions = this.tokens.getActions( stack );
			for ( let i = 0; i < actions.length;  ) {
				let action = actions[ i++ ],
					term = actions[ i++ ],
					end = actions[ i++ ];
				let last = i == actions.length || ! split;
				let localStack = last ? stack : stack.split();
				let main = this.tokens.mainToken;
				localStack.apply(
					action,
					term,
					main ? main.start : localStack.pos,
					end
				);
				if ( verbose )
					console.log(
						base +
							this.stackID( localStack ) +
							` (via ${
								( action & 65536 ) == 0
									? 'shift'
									: `reduce of ${ parser2.getName(
											action & 65535
											/* Action.ValueMask */
									  ) }`
							} for ${ parser2.getName( term ) } @ ${ start }${
								localStack == stack ? '' : ', split'
							})`
					);
				if ( last ) return true;
				else if ( localStack.pos > start ) stacks.push( localStack );
				else split.push( localStack );
			}
			return false;
		}
		// Advance a given stack forward as far as it will go. Returns the
		// (possibly updated) stack if it got stuck, or null if it moved
		// forward and was given to `pushStackDedup`.
		advanceFully( stack, newStacks ) {
			let pos = stack.pos;
			for (;;) {
				if ( ! this.advanceStack( stack, null, null ) ) return false;
				if ( stack.pos > pos ) {
					pushStackDedup( stack, newStacks );
					return true;
				}
			}
		}
		runRecovery( stacks, tokens, newStacks ) {
			let finished = null,
				restarted = false;
			for ( let i = 0; i < stacks.length; i++ ) {
				let stack = stacks[ i ],
					token = tokens[ i << 1 ],
					tokenEnd = tokens[ ( i << 1 ) + 1 ];
				let base = verbose ? this.stackID( stack ) + ' -> ' : '';
				if ( stack.deadEnd ) {
					if ( restarted ) continue;
					restarted = true;
					stack.restart();
					if ( verbose )
						console.log(
							base + this.stackID( stack ) + ' (restarted)'
						);
					let done = this.advanceFully( stack, newStacks );
					if ( done ) continue;
				}
				let force = stack.split(),
					forceBase = base;
				for ( let j = 0; force.forceReduce() && j < 10; j++ ) {
					if ( verbose )
						console.log(
							forceBase +
								this.stackID( force ) +
								' (via force-reduce)'
						);
					let done = this.advanceFully( force, newStacks );
					if ( done ) break;
					if ( verbose ) forceBase = this.stackID( force ) + ' -> ';
				}
				for ( let insert of stack.recoverByInsert( token ) ) {
					if ( verbose )
						console.log(
							base +
								this.stackID( insert ) +
								' (via recover-insert)'
						);
					this.advanceFully( insert, newStacks );
				}
				if ( this.stream.end > stack.pos ) {
					if ( tokenEnd == stack.pos ) {
						tokenEnd++;
						token = 0;
					}
					stack.recoverByDelete( token, tokenEnd );
					if ( verbose )
						console.log(
							base +
								this.stackID( stack ) +
								` (via recover-delete ${ this.parser.getName(
									token
								) })`
						);
					pushStackDedup( stack, newStacks );
				} else if ( ! finished || finished.score < stack.score ) {
					finished = stack;
				}
			}
			return finished;
		}
		// Convert the stack's buffer to a syntax tree.
		stackToTree( stack ) {
			stack.close();
			return Tree.build( {
				buffer: StackBufferCursor.create( stack ),
				nodeSet: this.parser.nodeSet,
				topID: this.topTerm,
				maxBufferLength: this.parser.bufferLength,
				reused: this.reused,
				start: this.ranges[ 0 ].from,
				length: stack.pos - this.ranges[ 0 ].from,
				minRepeatType: this.parser.minRepeatTerm,
			} );
		}
		stackID( stack ) {
			let id = (
				stackIDs || ( stackIDs = /* @__PURE__ */ new WeakMap() )
			).get( stack );
			if ( ! id )
				stackIDs.set(
					stack,
					( id = String.fromCodePoint( this.nextStackID++ ) )
				);
			return id + stack;
		}
	}
	function pushStackDedup( stack, newStacks ) {
		for ( let i = 0; i < newStacks.length; i++ ) {
			let other = newStacks[ i ];
			if ( other.pos == stack.pos && other.sameState( stack ) ) {
				if ( newStacks[ i ].score < stack.score )
					newStacks[ i ] = stack;
				return;
			}
		}
		newStacks.push( stack );
	}
	class Dialect {
		constructor( source, flags, disabled ) {
			this.source = source;
			this.flags = flags;
			this.disabled = disabled;
		}
		allows( term ) {
			return ! this.disabled || this.disabled[ term ] == 0;
		}
	}
	class LRParser extends Parser {
		/**
    @internal
    */
		constructor( spec ) {
			super();
			this.wrappers = [];
			if ( spec.version != 14 )
				throw new RangeError(
					`Parser version (${
						spec.version
					}) doesn't match runtime version (${ 14 })`
				);
			let nodeNames = spec.nodeNames.split( ' ' );
			this.minRepeatTerm = nodeNames.length;
			for ( let i = 0; i < spec.repeatNodeCount; i++ )
				nodeNames.push( '' );
			let topTerms = Object.keys( spec.topRules ).map(
				( r ) => spec.topRules[ r ][ 1 ]
			);
			let nodeProps = [];
			for ( let i = 0; i < nodeNames.length; i++ ) nodeProps.push( [] );
			function setProp( nodeID, prop, value ) {
				nodeProps[ nodeID ].push( [
					prop,
					prop.deserialize( String( value ) ),
				] );
			}
			if ( spec.nodeProps )
				for ( let propSpec of spec.nodeProps ) {
					let prop = propSpec[ 0 ];
					if ( typeof prop == 'string' ) prop = NodeProp[ prop ];
					for ( let i = 1; i < propSpec.length;  ) {
						let next = propSpec[ i++ ];
						if ( next >= 0 ) {
							setProp( next, prop, propSpec[ i++ ] );
						} else {
							let value = propSpec[ i + -next ];
							for ( let j = -next; j > 0; j-- )
								setProp( propSpec[ i++ ], prop, value );
							i++;
						}
					}
				}
			this.nodeSet = new NodeSet(
				nodeNames.map( ( name2, i ) =>
					NodeType.define( {
						name: i >= this.minRepeatTerm ? void 0 : name2,
						id: i,
						props: nodeProps[ i ],
						top: topTerms.indexOf( i ) > -1,
						error: i == 0,
						skipped:
							spec.skippedNodes &&
							spec.skippedNodes.indexOf( i ) > -1,
					} )
				)
			);
			if ( spec.propSources )
				this.nodeSet = this.nodeSet.extend( ...spec.propSources );
			this.strict = false;
			this.bufferLength = DefaultBufferLength;
			let tokenArray = decodeArray( spec.tokenData );
			this.context = spec.context;
			this.specializerSpecs = spec.specialized || [];
			this.specialized = new Uint16Array( this.specializerSpecs.length );
			for ( let i = 0; i < this.specializerSpecs.length; i++ )
				this.specialized[ i ] = this.specializerSpecs[ i ].term;
			this.specializers = this.specializerSpecs.map( getSpecializer );
			this.states = decodeArray( spec.states, Uint32Array );
			this.data = decodeArray( spec.stateData );
			this.goto = decodeArray( spec.goto );
			this.maxTerm = spec.maxTerm;
			this.tokenizers = spec.tokenizers.map( ( value ) =>
				typeof value == 'number'
					? new TokenGroup( tokenArray, value )
					: value
			);
			this.topRules = spec.topRules;
			this.dialects = spec.dialects || {};
			this.dynamicPrecedences = spec.dynamicPrecedences || null;
			this.tokenPrecTable = spec.tokenPrec;
			this.termNames = spec.termNames || null;
			this.maxNode = this.nodeSet.types.length - 1;
			this.dialect = this.parseDialect();
			this.top = this.topRules[ Object.keys( this.topRules )[ 0 ] ];
		}
		createParse( input, fragments, ranges ) {
			let parse = new Parse( this, input, fragments, ranges );
			for ( let w of this.wrappers )
				parse = w( parse, input, fragments, ranges );
			return parse;
		}
		/**
    Get a goto table entry @internal
    */
		getGoto( state, term, loose = false ) {
			let table = this.goto;
			if ( term >= table[ 0 ] ) return -1;
			for ( let pos = table[ term + 1 ]; ;  ) {
				let groupTag = table[ pos++ ],
					last = groupTag & 1;
				let target = table[ pos++ ];
				if ( last && loose ) return target;
				for ( let end = pos + ( groupTag >> 1 ); pos < end; pos++ )
					if ( table[ pos ] == state ) return target;
				if ( last ) return -1;
			}
		}
		/**
    Check if this state has an action for a given terminal @internal
    */
		hasAction( state, terminal ) {
			let data = this.data;
			for ( let set = 0; set < 2; set++ ) {
				for (
					let i = this.stateSlot(
							state,
							set ? 2 : 1
							/* ParseState.Actions */
						),
						next;
					;
					i += 3
				) {
					if ( ( next = data[ i ] ) == 65535 ) {
						if ( data[ i + 1 ] == 1 )
							next = data[ ( i = pair( data, i + 2 ) ) ];
						else if ( data[ i + 1 ] == 2 )
							return pair( data, i + 2 );
						else break;
					}
					if ( next == terminal || next == 0 )
						return pair( data, i + 1 );
				}
			}
			return 0;
		}
		/**
    @internal
    */
		stateSlot( state, slot ) {
			return this.states[ state * 6 + slot ];
		}
		/**
    @internal
    */
		stateFlag( state, flag ) {
			return (
				( this.stateSlot(
					state,
					0
					/* ParseState.Flags */
				) &
					flag ) >
				0
			);
		}
		/**
    @internal
    */
		validAction( state, action ) {
			return !! this.allActions( state, ( a ) =>
				a == action ? true : null
			);
		}
		/**
    @internal
    */
		allActions( state, action ) {
			let deflt = this.stateSlot(
				state,
				4
				/* ParseState.DefaultReduce */
			);
			let result = deflt ? action( deflt ) : void 0;
			for (
				let i = this.stateSlot(
					state,
					1
					/* ParseState.Actions */
				);
				result == null;
				i += 3
			) {
				if ( this.data[ i ] == 65535 ) {
					if ( this.data[ i + 1 ] == 1 ) i = pair( this.data, i + 2 );
					else break;
				}
				result = action( pair( this.data, i + 1 ) );
			}
			return result;
		}
		/**
    Get the states that can follow this one through shift actions or
    goto jumps. @internal
    */
		nextStates( state ) {
			let result = [];
			for (
				let i = this.stateSlot(
					state,
					1
					/* ParseState.Actions */
				);
				;
				i += 3
			) {
				if ( this.data[ i ] == 65535 ) {
					if ( this.data[ i + 1 ] == 1 ) i = pair( this.data, i + 2 );
					else break;
				}
				if ( ( this.data[ i + 2 ] & ( 65536 >> 16 ) ) == 0 ) {
					let value = this.data[ i + 1 ];
					if ( ! result.some( ( v, i2 ) => i2 & 1 && v == value ) )
						result.push( this.data[ i ], value );
				}
			}
			return result;
		}
		/**
    Configure the parser. Returns a new parser instance that has the
    given settings modified. Settings not provided in `config` are
    kept from the original parser.
    */
		configure( config ) {
			let copy = Object.assign(
				Object.create( LRParser.prototype ),
				this
			);
			if ( config.props )
				copy.nodeSet = this.nodeSet.extend( ...config.props );
			if ( config.top ) {
				let info = this.topRules[ config.top ];
				if ( ! info )
					throw new RangeError(
						`Invalid top rule name ${ config.top }`
					);
				copy.top = info;
			}
			if ( config.tokenizers )
				copy.tokenizers = this.tokenizers.map( ( t2 ) => {
					let found = config.tokenizers.find( ( r ) => r.from == t2 );
					return found ? found.to : t2;
				} );
			if ( config.specializers ) {
				copy.specializers = this.specializers.slice();
				copy.specializerSpecs = this.specializerSpecs.map( ( s, i ) => {
					let found = config.specializers.find(
						( r ) => r.from == s.external
					);
					if ( ! found ) return s;
					let spec = Object.assign( Object.assign( {}, s ), {
						external: found.to,
					} );
					copy.specializers[ i ] = getSpecializer( spec );
					return spec;
				} );
			}
			if ( config.contextTracker ) copy.context = config.contextTracker;
			if ( config.dialect )
				copy.dialect = this.parseDialect( config.dialect );
			if ( config.strict != null ) copy.strict = config.strict;
			if ( config.wrap )
				copy.wrappers = copy.wrappers.concat( config.wrap );
			if ( config.bufferLength != null )
				copy.bufferLength = config.bufferLength;
			return copy;
		}
		/**
    Tells you whether any [parse wrappers](#lr.ParserConfig.wrap)
    are registered for this parser.
    */
		hasWrappers() {
			return this.wrappers.length > 0;
		}
		/**
    Returns the name associated with a given term. This will only
    work for all terms when the parser was generated with the
    `--names` option. By default, only the names of tagged terms are
    stored.
    */
		getName( term ) {
			return this.termNames
				? this.termNames[ term ]
				: String(
						( term <= this.maxNode &&
							this.nodeSet.types[ term ].name ) ||
							term
				  );
		}
		/**
    The eof term id is always allocated directly after the node
    types. @internal
    */
		get eofTerm() {
			return this.maxNode + 1;
		}
		/**
    The type of top node produced by the parser.
    */
		get topNode() {
			return this.nodeSet.types[ this.top[ 1 ] ];
		}
		/**
    @internal
    */
		dynamicPrecedence( term ) {
			let prec = this.dynamicPrecedences;
			return prec == null ? 0 : prec[ term ] || 0;
		}
		/**
    @internal
    */
		parseDialect( dialect ) {
			let values = Object.keys( this.dialects ),
				flags = values.map( () => false );
			if ( dialect )
				for ( let part of dialect.split( ' ' ) ) {
					let id = values.indexOf( part );
					if ( id >= 0 ) flags[ id ] = true;
				}
			let disabled = null;
			for ( let i = 0; i < values.length; i++ )
				if ( ! flags[ i ] ) {
					for (
						let j = this.dialects[ values[ i ] ], id;
						( id = this.data[ j++ ] ) != 65535;

					)
						( disabled ||
							( disabled = new Uint8Array( this.maxTerm + 1 ) ) )[
							id
						] = 1;
				}
			return new Dialect( dialect, flags, disabled );
		}
		/**
    Used by the output of the parser generator. Not available to
    user code. @hide
    */
		static deserialize( spec ) {
			return new LRParser( spec );
		}
	}
	function pair( data, off ) {
		return data[ off ] | ( data[ off + 1 ] << 16 );
	}
	function findFinished( stacks ) {
		let best = null;
		for ( let stack of stacks ) {
			let stopped = stack.p.stoppedAt;
			if (
				( stack.pos == stack.p.stream.end ||
					( stopped != null && stack.pos > stopped ) ) &&
				stack.p.parser.stateFlag(
					stack.state,
					2
					/* StateFlag.Accepting */
				) &&
				( ! best || best.score < stack.score )
			)
				best = stack;
		}
		return best;
	}
	function getSpecializer( spec ) {
		if ( spec.external ) {
			let mask = spec.extend ? 1 : 0;
			return ( value, stack ) =>
				( spec.external( value, stack ) << 1 ) | mask;
		}
		return spec.get;
	}
	const highlighting = styleTags( {
		ControlKeyword: tags.controlKeyword,
		DeclarationKeyword: tags.definitionKeyword,
		ModifierKeyword: tags.modifier,
		TypeKeyword: tags.typeName,
		'TypeName/Identifier': tags.typeName,
		'CallName/Identifier': tags.function( tags.name ),
		'MemberExpression/PropertyName/Identifier': tags.propertyName,
		'CallExpression/MemberExpression/Identifier': tags.function(
			tags.name
		),
		'CallExpression/Identifier': tags.function( tags.name ),
		Identifier: tags.name,
		OperatorKeyword: tags.operatorKeyword,
		Operator: tags.operator,
		CompareOp: tags.operator,
		LogicalOp: tags.operator,
		LineComment: tags.comment,
		MultiLineComment: tags.comment,
		Pragma: tags.annotation,
		StringLiteral: tags.string,
		TypedStringLiteral: tags.string,
		'TypedStringLiteral/TypeKeyword': tags.string,
		NumericLiteral: tags.number,
		TypedNumericLiteral: tags.number,
		'TypedNumericLiteral/TypeKeyword': tags.number,
		DateTimeLiteral: tags.number,
		TypedDateTimeLiteral: tags.number,
		'TypedDateTimeLiteral/TypeKeyword': tags.number,
		BooleanLiteral: tags.bool,
		Punc: tags.punctuation,
	} );
	const spec_Identifier = {
		__proto__: null,
		VAR: 16,
		VAR_INPUT: 18,
		VAR_IN_OUT: 20,
		VAR_OUTPUT: 22,
		VAR_TEMP: 24,
		VAR_STAT: 26,
		VAR_INST: 28,
		VAR_GLOBAL: 30,
		VAR_EXTERNAL: 32,
		VAR_CONFIG: 34,
		CONSTANT: 36,
		PERSISTENT: 38,
		RETAIN: 40,
		AT: 44,
		BOOL: 52,
		BYTE: 54,
		SINT: 56,
		USINT: 58,
		WORD: 60,
		INT: 62,
		UINT: 64,
		DWORD: 66,
		DINT: 68,
		UDINT: 70,
		LWORD: 72,
		LINT: 74,
		ULINT: 76,
		REAL: 78,
		LREAL: 80,
		CHAR: 82,
		WCHAR: 84,
		STRING: 86,
		WSTRING: 88,
		TIME: 90,
		LTIME: 92,
		DATE_AND_TIME: 94,
		LDATE_AND_TIME: 96,
		DATE: 98,
		LDATE: 100,
		TIME_OF_DAY: 102,
		LTIME_OF_DAY: 104,
		BIT: 106,
		ANY: 108,
		ANY_DATE: 110,
		ANY_BIT: 112,
		ANY_NUM: 114,
		ANY_REAL: 116,
		ANY_INT: 118,
		ANY_STRING: 120,
		UCHAR: 122,
		USTRING: 124,
		POINTER: 126,
		TO: 128,
		REFERENCE: 130,
		ARRAY: 132,
		SUPER: 136,
		THIS: 138,
		TRUE: 150,
		FALSE: 150,
		NOT: 162,
		MOD: 170,
		AND: 174,
		OR: 176,
		AND_THEN: 178,
		OR_ELSE: 180,
		XOR: 182,
		'REF=': 200,
		OF: 212,
		END_VAR: 216,
		TYPE: 220,
		EXTENDS: 222,
		STRUCT: 224,
		END_STRUCT: 226,
		END_TYPE: 228,
		UNION: 230,
		END_UNION: 232,
		PROGRAM: 234,
		METHOD: 240,
		IF: 246,
		THEN: 248,
		ELSIF: 250,
		ELSE: 252,
		END_IF: 254,
		CASE: 258,
		END_CASE: 260,
		FOR: 264,
		BY: 266,
		DO: 268,
		END_FOR: 270,
		WHILE: 272,
		END_WHILE: 274,
		REPEAT: 276,
		UNTIL: 278,
		END_REPEAT: 280,
		RETURN: 284,
		EXIT: 286,
		CONTINUE: 288,
		JMP: 292,
		END_METHOD: 298,
		PROPERTY_GET: 304,
		PROPERTY_SET: 306,
		PUBLIC: 308,
		PRIVATE: 310,
		INTERNAL: 312,
		PROTECTED: 314,
		FINAL: 316,
		END_PROPERTY: 318,
		END_PROGRAM: 320,
		FUNCTION: 324,
		END_FUNCTION: 326,
		FUNCTION_BLOCK: 330,
		IMPLEMENTS: 332,
		END_FUNCTION_BLOCK: 334,
		INTERFACE: 338,
		END_INTERFACE: 340,
	};
	const parser = LRParser.deserialize( {
		version: 14,
		states: "GSQ`QPOOO(YQPO'#CuOOQO'#Gd'#GdO(dQPO'#DtOOQO'#D{'#D{O(iQPO'#DzOOQO'#EO'#EOO(iQPO'#D}O+qQPO'#FeO,lQPO'#E]O&`QPO'#GjOOQO'#Gj'#GjOOQO'#Ek'#EkOOQO'#FT'#FTOOQO'#Ff'#FfOOQO'#HS'#HSOOQO'#Ca'#CaOOQO'#F}'#F}Q`QPOOO,qQPO'#CbO-SQPO'#EmO-XQPO'#G|O-^QPO'#EwO(iQPO'#EzO(iQPO'#FQO-cQPO'#HUO(iQPO'#HVO-nQPO'#HWO&ZQPO'#F_O.eQPO'#FcO.jQPO'#EvO0PQPO'#FiO0eQPO'#FhO1zQPO'#HRO-^QPO'#FsO2PQPO'#HYO-SQPO'#FvO3fQPO'#HZO-SQPO'#FzO5UQPO'#H[OOQO'#Ea'#EaOOQO'#Eb'#EbOOQO'#Ec'#EcO(iQPO,5:zO5^QPO,5:zO5iQPO,5:`O6lQPO,5:fO6sQPO,5:iOOQO'#ER'#EROOQO'#ES'#ESO(iQPO,5:lO(iQPO,5:lO(iQPO,5:lO(iQPO,5:lO7mQQO'#EfOOQO,5;P,5;POOQO,5<P,5<POOQO'#EU'#EUOOQO'#E_'#E_O7wQPO'#GQO7|QPO,5:wOOQO-E9{-E9{OOQO'#GO'#GOO9yQPO,58|O:[QPO'#CqOOQO'#GP'#GPO:dQPO,58|OOQO'#G_'#G_OOQO,58|,58|OOQO'#Cu'#CuO:lQPO,5;XOOQO'#Ct'#CtO=^QPO,5=hOOQO'#Ey'#EyO=kQPO,5;cOBXQPO,5;fOB`QPO,5;lOBgQPO'#E^OBxQPO'#E`OCWQPO,5=pOC]QPO,5=qOOQO'#GW'#GWOCdQPO,5=rO(iQPO,5=rOOQO,5;y,5;yO&ZQPO,5;}OOQO'#GV'#GVODZQPO,5;bOOQO,5;b,5;bOOQO'#HX'#HXO-XQPO,5<TO-^QPO,5<TOEpQPO,5<SOGVQPO,5<SOG[QPO,5=mOHzQPO,5<_OMhQPO,5=tOOQO,5=t,5=tON}QPO,5<bOOQO'#GU'#GUO!%wQPO,5=uOOQO,5=u,5=uOOQO,5<f,5<fOOQO'#GZ'#GZO!'gQPO,5=vOOQO,5=v,5=vO!'oQPO1G0fO(iQPO1G0fOOQO1G/z1G/zOOQO1G/|1G/|OOQO1G0O1G0OOOQO'#D|'#D|OOQO1G0Q1G0QO!)|QPO1G0WO!*ZQPO1G0WO!+uQPO1G0WO!,YQPO1G0WO!,mQPO'#GvO(iQPO'#GvO!,wQPO,5;QOOQO,5<l,5<lOOQO-E:O-E:OOOQO-E9|-E9|O!,|QPO1G.hOOQO1G.h1G.hO!-UQPO,59]O!/wQPO,59]OOQO-E9}-E9}O-SQPO1G0sO!/|QPO1G3SO!0XQPO1G3TO!0dQPO1G3UO!0kQPO1G3WO!0pQPO1G0}O!3`QPO1G1QO!4]QPO1G1WO(iQPO1G3[O!4gQPO1G3]OOQO-E:U-E:UO(iQPO1G3^O!5^QPO1G3^OOQO1G1i1G1iOOQO-E:T-E:TOOQO1G0|1G0|O!0pQPO1G1oO-XQPO1G1oO!5eQPO1G1nOOQO1G1n1G1nO!5jQPO1G3XOOQO1G3X1G3XO!0pQPO1G1yOOQO1G3`1G3`O-SQPO1G1|O-SQPO1G1|OOQO-E:S-E:SOOQO1G3a1G3aOOQO-E:X-E:XOOQO1G3b1G3bO!7YQPO7+&QOOQO'#Eg'#EgO!8SQQO'#GRO!8ZQPO,5=bO!8cQPO,5=bOOQO1G0l1G0lOOQO7+$S7+$SO!8mQPO1G.wO!8uQPO'#GeO!8zQPO'#GfO!9PQPO'#GgO!9UQSO'#G`O-XQPO1G.wOOQO7+&_7+&_O!9ZQPO7+(nOOQO7+(n7+(nO!9aQPO7+(nO!9fQPO7+(oOOQO7+(o7+(oO!9qQPO7+(oO!9vQPO'#HPO!,wQPO7+(pOOQO7+(r7+(rOOQO7+&i7+&iO!:QQPO7+&lO!:}QPO7+&lO(iQPO'#GXOOQO7+&l7+&lO!;YQPO7+&lO!<PQPO'#HTOOQO'#GY'#GYO!<WQPO7+&rOOQO7+&r7+&rO!<bQPO7+&rO!=XQPO7+(vO!=cQPO7+(wOOQO7+(w7+(wO!>YQPO7+(xOOQO7+(x7+(xOOQO7+'Z7+'ZO!0pQPO7+'ZOOQO7+'Y7+'YOOQO7+(s7+(sOOQO7+'e7+'eOOQO7+'h7+'hO!>aQPO7+'hO!CWQPO,5<mO(iQPO,5<mOOQO-E:P-E:PO!CbQPO1G2|OOQO7+$c7+$cO(iQPO7+$cO!CjQPO,5=PO!CjQPO,5=QOOQO'#Dq'#DqO!FSQPO,5=RO!FZQPO,5<zO!-UQPO7+$cOOQO<<LY<<LYO!F`QPO<<LYOOQO<<LZ<<LZO!FeQPO<<LZO(iQPO'#GTO!FjQPO,5=kO&ZQPO<<L[O!FrQPO<<JWOOQO<<JW<<JWO!F}QPO<<JWOOQO-E:V-E:VO!GtQPO,5<sO!F}QPO<<JWO!HmQPO,5=oOOQO-E:W-E:WOOQO<<J^<<J^O!K}QPO<<J^O!K}QPO<<J^O!LtQPO<<LbO(iQPO<<LbOOQO<<Lc<<LcOOQO<<Ld<<LdOOQO<<Ju<<JuO-SQPO<<KSO!MkQPO1G2XO+qQPO<<G}OOQO1G2k1G2kOOQO1G2l1G2lO!MuQPO'#GiO!M|QPO1G2mOOQO1G2f1G2fO!8mQPO<<G}OOQOANAtANAtOOQOANAuANAuO!NRQPO,5<oOOQO-E:R-E:RO!N]QPOANAvOOQOAN?rAN?rO!NbQPOAN?rO!NbQPOAN?rO# XQPO1G2_O#!UQPO1G3ZO#%fQPOAN?xOOQOAN?xAN?xO#&]QPOANA|OOQOANA|ANA|O#'SQPOANA|OOQOAN@nAN@nOOQOAN=iAN=iOOQO'#Eh'#EhO(iQPO,5=TOOQO'#Ei'#EiO#'ZQPO7+(XO(iQPOAN=iOOQOG27bG27bO#'`QPOG25^OOQOG25^G25^O#(VQPO7+'yOOQOG25dG25dOOQOG27hG27hO#)SQPOG27hO#)yQPO1G2oO!CjQPO<<KsO+qQPOG23TOOQOLD*xLD*xO#*TQPOLD-SOOQOLD-SLD-SO(iQPO'#GSO#*zQPO7+(ZOOQOANA_ANA_OOQOLD(oLD(oOOQO!$(!n!$(!nO!MuQPO,5<nOOQO-E:Q-E:QO(iQPO1G2YO#+SQPO7+'t",
		stateData:
			"#+e~O%QOSPOSQOSROS~OVPOWcOXcOYcOZcO[cO]cO^cO_cO`cOacOgZOjQOkQOlQOmQOnQOoQOpQOqQOrQOsQOtQOuQOvQOwQOxQOyQOzQO{QO|QO}QO!OQO!PQO!QQO!RQO!SQO!TQO!UQO!VQO!WQO!XQO!YQO!ZQO![QO!]QO!^QO!_QO!`QO!fYO!gYO!iZO!kZO!mZO!sVO#bdO#iqO#lfO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$^oO$_oO$hrO$ktO$ovO%`SO%bUO%cUO%o[O~O#W{O%gxO%hyO%izO!w%^X!y%^X!z%^X!{%^X!|%^X!}%^X#O%^X%`%^X%b%^X%c%^X%d%^X%e%^X%o%^X%a%^X#p%^X#^%^X#z%^X%l%^X$Q%^X%V%^X!b%^X#y%^X%m%^X%n%^X~O%_iX%f#QX~P&`O%_}O~OVPOgZOjQOkQOlQOmQOnQOoQOpQOqQOrQOsQOtQOuQOvQOwQOxQOyQOzQO{QO|QO}QO!OQO!PQO!QQO!RQO!SQO!TQO!UQO!VQO!WQO!XQO!YQO!ZQO![QO!]QO!^QO!_QO!`QO!fYO!gYO!iZO!kZO!mZO!sVO%`SO%bUO%cUO~O!w!SO!y!ZO!z!ZO!{!ZO!|!ZO!}!ZO#O!VO%`SO%bUO%cUO%d!QO%e!RO%o[O~O%f![O~OV!bOb!eOc!eOd!eO#`!fO~OV!gO~O%V!iO~OV!kO~OV!oO!f!pO!g!pO~O#ogO#uhO#xiO#|jO$OkO$P!uO$SlO$TlO$UlO$WmO%o[O~P(iOV!wO~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$Z!zO%o[O~P(iOV!kO$`!{O$a!{O$b!{O$c!{O$d!{O~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$Z#PO%o[O~P(iOV#QO~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$i#TO%o[O~P(iOWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#lfO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$^oO$_oO$m#XO%o[O~P(iO#lfO$p#]O~O#W#_O%hyO%izO~Og#`O!i#aO!k#bO~O!w!SO!y!ZO!z!ZO!{!ZO!|!ZO!}!ZO#O!VO%`SO%bUO%cUO%d!QO%e!RO~O%a#cO~P5tO%o!qa%a!qa#p!qa#^!qa#z!qa%l!qa$Q!qa%V!qa!b!qa#y!qa%m!qa%n!qa~P5tO%k#jO%a%jP~P(iOV#lO~O%f![O!w#Pa!y#Pa!z#Pa!{#Pa!|#Pa!}#Pa#O#Pa#W#Pa%`#Pa%b#Pa%c#Pa%d#Pa%e#Pa%g#Pa%h#Pa%i#Pa%o#Pa%a#Pa#p#Pa#^#Pa#z#Pa%l#Pa$Q#Pa%V#Pa!b#Pa#y#Pa%m#Pa%n#Pa~OV!bOb!eOc!eOd!eO#`#pO~Of#rO%V!iO~OV!bO#`#pO~O#c#tO%V#aa~OjQOkQOlQOmQOnQOoQOpQOqQOrQOsQOtQOuQOvQOwQOxQOyQOzQO{QO|QO}QO!OQO!PQO!QQO!RQO!SQO!TQO!UQO!VQO!WQO!XQO!YQO!ZQO![QO!]QO!^QO!_QO!`QO%`SO~OV!gO#d#uO#g#vO~P:tO%V!iOV#kaW#kaX#kaY#kaZ#ka[#ka]#ka^#ka_#ka`#kaa#kag#kaj#kak#kal#kam#kan#kao#kap#kaq#kar#kas#kat#kau#kav#kaw#kax#kay#kaz#ka{#ka|#ka}#ka!O#ka!P#ka!Q#ka!R#ka!S#ka!T#ka!U#ka!V#ka!W#ka!X#ka!Y#ka!Z#ka![#ka!]#ka!^#ka!_#ka!`#ka!f#ka!g#ka!i#ka!k#ka!m#ka!s#ka#o#ka#u#ka#x#ka#|#ka$O#ka$S#ka$T#ka$U#ka$W#ka$Z#ka%`#ka%b#ka%c#ka%o#ka~O#p#zO~P5tO#^#{O~P5tO#W{O%gxO%hyO%izO%f#QX~O#W{O%gxO%hyO%izO~O!b#|O~O#z#}O~P5tO#ogO#uhO#xiO#|jO$OkO$P$PO$SlO$TlO$UlO$WmO%o[O~P(iOWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$Z$TO%o[O~P(iOWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$Z$WO%o[O~P(iO$e$XO~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#lfO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$^oO$_oO$f$ZO%o[O~P(iO%V!iOV$gaW$gaX$gaY$gaZ$ga[$ga]$ga^$ga_$ga`$gaa$gag$gaj$gak$gal$gam$gan$gao$gap$gaq$gar$gas$gat$gau$gav$gaw$gax$gay$gaz$ga{$ga|$ga}$ga!O$ga!P$ga!Q$ga!R$ga!S$ga!T$ga!U$ga!V$ga!W$ga!X$ga!Y$ga!Z$ga![$ga!]$ga!^$ga!_$ga!`$ga!f$ga!g$ga!i$ga!k$ga!m$ga!s$ga#o$ga#u$ga#x$ga#|$ga$O$ga$S$ga$T$ga$U$ga$W$ga$i$ga%`$ga%b$ga%c$ga%o$ga~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$i$]O%o[O~P(iO#c$_O$l$^OV$jaW$jaX$jaY$jaZ$ja[$ja]$ja^$ja_$ja`$jaa$jag$jaj$jak$jal$jam$jan$jao$jap$jaq$jar$jas$jat$jau$jav$jaw$jax$jay$jaz$ja{$ja|$ja}$ja!O$ja!P$ja!Q$ja!R$ja!S$ja!T$ja!U$ja!V$ja!W$ja!X$ja!Y$ja!Z$ja![$ja!]$ja!^$ja!_$ja!`$ja!f$ja!g$ja!i$ja!k$ja!m$ja!s$ja#l$ja#o$ja#u$ja#x$ja#|$ja$O$ja$S$ja$T$ja$U$ja$W$ja$^$ja$_$ja$m$ja%`$ja%b$ja%c$ja%o$ja~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#lfO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$^oO$_oO$m$aO%o[O~P(iO#lfO$p$cO~O%o#Si%a#Si#p#Si#^#Si!b#Si#z#Si%l#Si$Q#Si%V#Si#y#Si%m#Si%n#Si~P5tO%`SO!y!ti!z!ti!{!ti!|!ti!}!ti#O!ti%b!ti%c!ti%o!ti%a!ti#p!ti#^!ti#z!ti%l!ti$Q!ti%V!ti!b!ti#y!ti%m!ti%n!ti~O!w!ti%d!ti%e!ti~P!(iO!w!SO%d!QO%e!RO~P!(iO!w!SO%`SO%bUO%cUO%d!QO%e!RO#O!ti%o!ti%a!ti#p!ti#^!ti#z!ti%l!ti$Q!ti%V!ti!b!ti#y!ti%m!ti%n!ti~O!y!ti!z!ti!{!ti!|!ti!}!ti~P!*hO!y!ZO!z!ZO!{!ZO!|!ZO!}!ZO~P!*hO%l$eO%a%jX~P5tO%a#cO~OV!bO#`$jO~OV!gOjQOkQOlQOmQOnQOoQOpQOqQOrQOsQOtQOuQOvQOwQOxQOyQOzQO{QO|QO}QO!OQO!PQO!QQO!RQO!SQO!TQO!UQO!VQO!WQO!XQO!YQO!ZQO![QO!]QO!^QO!_QO!`QO!a$lO!c$mO!d$nO~O%T$oO~OV!bO#e$tO#f$sO~OV!bO#f$vO#h$wO~O%a%sP~P(iO#f$zO~OV!gOjQOkQOlQOmQOnQOoQOpQOqQOrQOsQOtQOuQOvQOwQOxQOyQOzQO{QO|QO}QO!OQO!PQO!QQO!RQO!SQO!TQO!UQO!VQO!WQO!XQO!YQO!ZQO![QO!]QO!^QO!_QO!`QO!a$lO!c$mO~O#ogO#q%OO#r%QO#s%PO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#r%VO#v%UO~P(iO#ogO#uhO#xiO#|jO#}%YO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO$Q%[O~P5tO$e%_O~OWcOXcOYcOZcO[cO]cO^cO_cO`cOacO#lfO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO$^oO$_oO$f%`O%o[O~P(iO%o#Sq%a#Sq#p#Sq#^#Sq!b#Sq#z#Sq%l#Sq$Q#Sq%V#Sq#y#Sq%m#Sq%n#Sq~P5tO%k%eO~P(iO%l$eO%a%ja~O%l$eO%a%ja~P5tO%hyO%o[O~O!b%jO~O!b%kO~O%[%lO~O%U%nO~OV!bO#e%qO#f%pO~OV!bO#f%rO#h%sO~O#f%rO~O%l$eO%a%sX~P5tO#ogO#q%OO#r%yO#s%xO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#q%OO#r%yO#s%xO~O#ogO#s%xO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO%V!iO~P5tO#r&QO#v&PO~P(iO#ogO#uhO#v&PO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#y&TO#z&SO~P5tO#ogO#uhO#xiO#|jO#}&UO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO$Q&VO~P5tO$l&XOV$jqW$jqX$jqY$jqZ$jq[$jq]$jq^$jq_$jq`$jqa$jqg$jqj$jqk$jql$jqm$jqn$jqo$jqp$jqq$jqr$jqs$jqt$jqu$jqv$jqw$jqx$jqy$jqz$jq{$jq|$jq}$jq!O$jq!P$jq!Q$jq!R$jq!S$jq!T$jq!U$jq!V$jq!W$jq!X$jq!Y$jq!Z$jq![$jq!]$jq!^$jq!_$jq!`$jq!f$jq!g$jq!i$jq!k$jq!m$jq!s$jq#l$jq#o$jq#u$jq#x$jq#|$jq$O$jq$S$jq$T$jq$U$jq$W$jq$^$jq$_$jq$m$jq%`$jq%b$jq%c$jq%o$jq~O%a$ua%l$ua~P5tO%l$eO%a%ji~OV!gOjQOkQOlQOmQOnQOoQOpQOqQOrQOsQOtQOuQOvQOwQOxQOyQOzQO{QO|QO}QO!OQO!PQO!QQO!RQO!SQO!TQO!UQO!VQO!WQO!XQO!YQO!ZQO![QO!]QO!^QO!_QO!`QO~O%n%]P~P(iOg&`O~O#f&bO~O#f&cO~O%l$eO%a%sa~O#q%OO#r&hO#s&gO~O#ogO#s&gO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#p&jO~P5tO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~OV%wag%waj%wak%wal%wam%wan%wao%wap%waq%war%was%wat%wau%wav%waw%wax%way%waz%wa{%wa|%wa}%wa!O%wa!P%wa!Q%wa!R%wa!S%wa!T%wa!U%wa!V%wa!W%wa!X%wa!Y%wa!Z%wa![%wa!]%wa!^%wa!_%wa!`%wa!f%wa!g%wa!i%wa!k%wa!m%wa!s%wa#r%wa#v%wa%`%wa%b%wa%c%wa~P!G{O#ogO#uhO#v&mO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#ogO#uhO#xiO#{&oO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO%a$ui%l$ui~P5tO%m&sO~P5tO%n&uO~O%a$wa%l$wa~P5tO#f&xO~O#ogO#s&zO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O#q${i#r${i#s${i~P(iOV%wig%wij%wik%wil%wim%win%wio%wip%wiq%wir%wis%wit%wiu%wiv%wiw%wix%wiy%wiz%wi{%wi|%wi}%wi!O%wi!P%wi!Q%wi!R%wi!S%wi!T%wi!U%wi!V%wi!W%wi!X%wi!Y%wi!Z%wi![%wi!]%wi!^%wi!_%wi!`%wi!f%wi!g%wi!i%wi!k%wi!m%wi!s%wi#r%wi#v%wi%`%wi%b%wi%c%wi~P!G{O#ogO#uhO#v&|O#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#ogO#uhO#xiO#{&}O#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#z'OO~P5tO#^'QO~O#ogO#s'SO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO#ogO#uhO#xiO#|jO$OkO$SlO$TlO$UlO$WmO%o[O#q${q#r${q#s${q~P(iO#ogO#uhO#xiO#{'UO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO%l$eO%n%]i~P5tO#ogO#uhO#xiO#{'ZO#|jO$OkO$SlO$TlO$UlO$WmO%o[O~P(iO%l$eO%n%]q~O%l$vq%n$vq~P5tOP%dg%f!kV~",
		goto: "Fg&PPPPPP&Q&UPPPPPPPPPPPPPP&hPP&r'[PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP)aPP)dP)dP)dP)d*x-R)d-[P)d/`/`P0PPPPPPP0n2V3l3p5X5_5nP)d5w6i6w6}P7QP8`PPPPPPPP8d8rP8|9YPPPPP9YPP9YPPPPPPPPP9YPPP9YP:Q9YP:v;QPPPPPPPPP;YPP;^PPP;bPP;f;l;r<U<[<f<l<r<|=[>`>j>pPPP>v>zPPP>}ARARAePAkAnPPPPPPPPPPPD`PPPPPDcDcDcDgDcDcDjEhElElElFdDcDcDcTaObS`Ob[!xnps!y#O#SX#Vu#Q#W$Ya!cc!a!d#o#u#v$r$uQ!jeQ#q!bQ#y!lQ$U!|Q$[#RQ%^$VQ%o$pR%}%R$YQOTVbghjknpsu{!S!T!U!V!W!j!t!u!y#O#Q#S#W#_#j#q#w#y#z#{#|#}$P$U$Y$[$f$|%O%Q%T%V%X%^%e%i%j%k%m%o%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'Q'T'V'^Q!hdQ#UtQ#YvQ$q#tQ%b$^Q%c$_R&q&XR%m$n#uZOTVbghjknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^#tTOTVbghjknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^!^!WW!O!P!m!n!r#^#e#f#g#h#i$Q$d$h$x%R%W%Z%d%{&Y&Z&^&d&p'P'R'['_R#w!jQ#d!OQ$i#kR%v$y#tVOTVbghjknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^!Z!TW!O!P!m!n!r#^#g#h#i$Q$d$h$x%R%W%Z%d%{&Y&Z&^&d&p'P'R'['_!]!SW!O!P!m!n!r#^#f#g#h#i$Q$d$h$x%R%W%Z%d%{&Y&Z&^&d&p'P'R'['_!X!UW!O!P!m!n!r#^#h#i$Q$d$h$x%R%W%Z%d%{&Y&Z&^&d&p'P'R'['_#tYOTVbghjknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^R!pi#wXOTVbghijknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^T!]X!^#tZOTVbghjknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^R!qiX|PY!o!pW{PY!o!pQ#_|Q%i$kR&w&aW{PY!o!pR#_|!_!XW!O!P!m!n!r#^#e#f#g#h#i$Q$d$h$x%R%W%Z%d%{&Y&Z&^&d&p'P'R'['_W$f#i$g$h%gS%t$x%uT'V'P'WQ&t&^R'^'[R&v&_!j^Obknpsu!t!y#O#Q#S#W#z#}$Y$|%Q%V%X%y%|%}&Q&R&S&h&i&j&k&l&n&y&{'O'TQ!YWQ!vlQ$R!wQ%h$kQ&f%vS&r&Z&aR'Y'RTeObS`ObW#Vu#Q#W$YT#Zw#[anObuw#Q#W#[$YQ!lfQ!|oQ#RrR$V!}!k_Obknpsu!t!y#O#Q#S#W#z#}$Y$|%Q%V%X%y%|%}&Q&R&S&h&i&j&k&l&n&y&{'O'T!g_Obknpsu!t!y#O#Q#S#W#z#}$Y$|%Q%V%X%y%|&Q&R&S&h&i&j&l&n&y&{'O'TS`ObX#Vu#Q#W$Y]pObu#Q#W$YTsObTuObTwObQbOR!_bQ!acR#n!aQ!dcQ#o!aW#s!d#o$r$uQ$r#uR$u#vQ!^XR#m!^Q$g#iS%f$g%gR%g$hQ'W'PR']'WQ%u$xR&e%uQ#WuQ$Y#QT$`#W$YQ!ynQ#OpQ#SsV$S!y#O#SQ!tkh$O!t$|%X%|&R&i&k&l&n&y&{'TQ$|#zQ%X#}Q%|%QQ&R%VQ&i%yQ&k%}Q&l&QQ&n&SQ&y&hQ&{&jR'T'OQ$}#zQ%w$|T%z$}%wQ%T#{R&O%TQ#[wR$b#[T!`c!aR$p#r#tROTVbghjknpsu{!S!T!U!V!W!t!u!y#O#Q#S#W#_#j#w#z#{#|#}$P$Y$f$|%O%Q%T%V%X%e%i%m%t%y%|&Q&R&S&T&h&i&j&l&n&t&w&y&{'O'T'V'^Q#x!jQ$k#qQ${#yQ%]$UQ%a$[Q&W%^Q&[%jQ&]%kQ&a%oR'X'QQ$k#qQ${#yQ%]$UQ%a$[Q&W%^R&a%oQ$k#qR&a%oR&_%m!fWObknpsu!t!y#O#Q#S#W#z#}$Y$|%Q%V%X%y%|&Q&R&S&h&i&j&l&n&y&{'O'TQ!OTQ!PVQ!mgQ!nhQ!rjQ#^{Q#e!SQ#f!TQ#g!UQ#h!VQ#i!WQ$Q!uQ$d#_Q$h#jQ$x#wS%R#{%TQ%W#|Q%Z$PQ%d$fQ%{%OQ&Y%eQ&Z%iQ&^%mQ&d%tQ&p&TQ'P&tQ'R&wQ'['VR'_'^R#k!WT`ObR$y#wSaOb!Q!sk!t#z#}$|%Q%V%X%y%|%}&Q&R&S&h&i&j&k&l&n&y&{'O'T[!xnps!y#O#SX#Vu#Q#W$YT%S#{%T!k]Obknpsu!t!y#O#Q#S#W#z#}$Y$|%Q%V%X%y%|%}&Q&R&S&h&i&j&k&l&n&y&{'O'TR!}o",
		nodeNames:
			'⚠ LineComment MultiLineComment Pragma Program Declaration VarDeclaration Identifier DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword ModifierKeyword ModifierKeyword ModifierKeyword VariableDeclarationStatement ModifierKeyword NumericLiteral Punc TypeName TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword TypeKeyword ControlKeyword TypeKeyword TypeKeyword Punc ControlKeyword ControlKeyword TypedNumericLiteral StringLiteral TypedStringLiteral DateTimeLiteral TypedDateTimeLiteral BooleanLiteral ParenthesizedExpression Punc Punc UnaryExpression Operator OperatorKeyword BinaryExpression Operator Operator OperatorKeyword LogicalOp OperatorKeyword OperatorKeyword OperatorKeyword OperatorKeyword OperatorKeyword CompareOp MemberExpression PropertyName Punc AssignmentExpression Operator Operator Operator OperatorKeyword CallExpression ArgList Punc Punc Punc ControlKeyword Punc DeclarationKeyword TypeDecl DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword DeclarationKeyword MethodDeclaration MethDecl DeclarationKeyword CallName IfStatement ControlKeyword ControlKeyword ControlKeyword ControlKeyword ControlKeyword CaseStatement ControlKeyword ControlKeyword LoopStatement ControlKeyword ControlKeyword ControlKeyword ControlKeyword ControlKeyword ControlKeyword ControlKeyword ControlKeyword ControlKeyword KeywordStatement ControlKeyword ControlKeyword ControlKeyword JumpStatement ControlKeyword ExpressionStatement EmptyStatement DeclarationKeyword PropertyDeclaration PropDecl DeclarationKeyword DeclarationKeyword ModifierKeyword ModifierKeyword ModifierKeyword ModifierKeyword ModifierKeyword DeclarationKeyword DeclarationKeyword FuncDecl DeclarationKeyword DeclarationKeyword FbDecl DeclarationKeyword DeclarationKeyword DeclarationKeyword ItfDecl DeclarationKeyword DeclarationKeyword',
		maxTerm: 230,
		nodeProps: [
			[
				'group',
				-16,
				7,
				23,
				68,
				69,
				70,
				71,
				72,
				73,
				74,
				75,
				76,
				79,
				82,
				93,
				96,
				101,
				'Expression',
				-7,
				122,
				128,
				131,
				141,
				145,
				147,
				148,
				'Statement',
			],
		],
		propSources: [ highlighting ],
		skippedNodes: [ 0, 1, 2, 3 ],
		repeatNodeCount: 13,
		tokenData:
			"7m~R!QX^$Xpq$Xrs$|st%quv%vwx$|xy%{yz&xz{&}{|'S|}'X}!O'^!O!P'c!P!Q)R!Q!R)r!R!S*W!S!T+{!T!Y)r!Y!Z-O!Z![)r![!]-{!]!^.Y!^!_._!_!`.w!`!a.o!c!f/X!f!g/j!g!k/X!k!l1|!l!n/X!n!o2a!o!v/X!v!w3O!w!}/X!}#O6o#P#Q6t#Q#R6y#R#S/X#T#o/X#o#p7O#y#z$X$f$g$X#BY#BZ$X$IS$I_$X$I|$JO$X$JT$JU$X$KV$KW$X&FU&FV$X~$^Y%Q~X^$Xpq$X#y#z$X$f$g$X#BY#BZ$X$IS$I_$X$I|$JO$X$JT$JU$X$KV$KW$X&FU&FV$X~%PVOr$|rs%fsw$|wx%fx;'S$|;'S;=`%k<%lO$|~%kO!i~~%nP;=`<%l$|~%vO%_~~%{O%T~~&QP%`~z{&T~&WTOz&Tz{&g{;'S&T;'S;=`&r<%lO&T~&jPyz&m~&rOQ~~&uP;=`<%l&T~&}O%a~~'SO%e~~'XO%b~~'^O%l~~'cO%c~~'hQ%fP!O!P'n!Q!['{R'sP%mP!O!P'vQ'{O%kQ~(QSg~!Q!['{!g!h(^#R#S'{#X#Y(^~(aS{|(m}!O(m!Q![(v#R#S(v~(pQ!Q![(v#R#S(v~({Qg~!Q![(v#R#S(v~)WP%d~!P!Q)Z~)`SP~OY)ZZ;'S)Z;'S;=`)l<%lO)Z~)oP;=`<%l)Z~)wTg~!O!P'{!Q![)r!g!h(^#R#S)r#X#Y(^~*]Vg~!O!P'{!Q!W)r!W!X*r!X![)r!g!h(^#R#S)r#X#Y(^~*wUg~st+Z!O!P'{!Q![)r!g!h(^#R#S)r#X#Y(^~+^S!Q![+j!c!i+j#R#S+j#T#Z+j~+oSg~!Q![+j!c!i+j#R#S+j#T#Z+j~,QUg~st,d!O!P'{!Q![)r!g!h(^#R#S)r#X#Y(^~,gR!Q!R,p!R!S,p#R#S,p~,uRg~!Q!R,p!R!S,p#R#S,p~-TUg~st-g!O!P'{!Q![)r!g!h(^#R#S)r#X#Y(^~-jQ!Q!Y-p#R#S-p~-uQg~!Q!Y-p#R#S-p~.QP%V~!_!`.T~.YO%h~~._O%o~~.dQ#O~!_!`.j!`!a.o~.oO#O~~.tP#O~!_!`.j~.|Q#O~!_!`.j!`!a/S~/XO%i~R/^SVR!Q![/X!c!}/X#R#S/X#T#o/X~/oVVRst0U!Q![/X!c!v/X!v!w0p!w!}/X#R#S/X#T#o/X~0XR}!O0b!Q![0b#R#S0b~0gR!k~}!O0b!Q![0b#R#S0b~0uTVRst1U!Q![/X!c!}/X#R#S/X#T#o/X~1XT}!O1h!O!P1h!Q![1h![!]1h#R#S1h~1mT!k~}!O1h!O!P1h!Q![1h![!]1h#R#S1hV2TS%USVR!Q![/X!c!}/X#R#S/X#T#o/X~2fWVR!Q![/X!c!f/X!f!g/j!g!v/X!v!w3O!w!}/X#R#S/X#T#o/X~3TVVRst3j!Q![/X!c!q/X!q!r5Q!r!}/X#R#S/X#T#o/X~3mY!Q![4]!f!g4]!j!k4]!o!p4]!u!v4]#R#S4]#W#X4]#[#]4]#a#b4]#g#h4]~4bY!k~!Q![4]!f!g4]!j!k4]!o!p4]!u!v4]#R#S4]#W#X4]#[#]4]#a#b4]#g#h4]~5VUVR!Q![/X!c!f/X!f!g5i!g!}/X#R#S/X#T#o/X~5nTVRst5}!Q![/X!c!}/X#R#S/X#T#o/X~6QS!O!P6^!Q![6^![!]6^#R#S6^~6cS!k~!O!P6^!Q![6^![!]6^#R#S6^~6tO%[~~6yO%n~~7OO%g~~7RTO#q7O#q#r7b#r;'S7O;'S;=`7g<%lO7O~7gOR~~7jP;=`<%l7O",
		tokenizers: [ 0, 1, 2 ],
		topRules: { Program: [ 0, 4 ] },
		specialized: [
			{ term: 7, get: ( value ) => spec_Identifier[ value ] || -1 },
		],
		tokenPrec: 4706,
	} );
	const highlighter = tagHighlighter( [
		{ tag: tags.controlKeyword, class: 'token keyword control-flow' },
		{ tag: tags.operatorKeyword, class: 'token keyword' },
		{ tag: tags.definitionKeyword, class: 'token keyword' },
		{ tag: tags.modifier, class: 'token keyword' },
		{ tag: tags.typeName, class: 'token class-name' },
		{ tag: tags.number, class: 'token number' },
		{ tag: tags.bool, class: 'token boolean' },
		{ tag: tags.string, class: 'token string' },
		{ tag: tags.annotation, class: 'token cdata' },
		{ tag: tags.operator, class: 'token operator' },
		{ tag: tags.punctuation, class: 'token punctuation' },
		{ tag: tags.separator, class: 'token operator' },
		{ tag: tags.comment, class: 'token comment' },
		{ tag: tags.name, class: 'token variable' },
		{ tag: tags.function( tags.name ), class: 'token function' },
		{ tag: tags.propertyName, class: 'token property' },
	] );
	function renderHighlightedHTML( code, tree, highlighter2 ) {
		let html = '';
		highlightCode(
			code,
			tree,
			highlighter2,
			( text, classes ) => {
				if ( classes ) {
					html += `<span class="${ classes }">${ escapeHtml(
						text
					) }</span>`;
				} else {
					html += escapeHtml( text );
				}
			},
			() => {
				html += '<br/>';
			}
		);
		return html;
	}
	function escapeHtml( str ) {
		return str.replace(
			/[&<>"']/g,
			( ch ) =>
				( {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;',
				} )[ ch ]
		);
	}
	window.highlightCodeBlocks = function () {
		document
			.querySelectorAll( 'code.language-phioiecst' )
			.forEach( ( el ) => {
				const source = el.textContent;
				const tree = parser.parse( source );
				const html = renderHighlightedHTML( source, tree, highlighter );
				el.innerHTML = html;
			} );
	};
	window.addEventListener( 'DOMContentLoaded', () => {
		window.highlightCodeBlocks();
	} );
} )();
