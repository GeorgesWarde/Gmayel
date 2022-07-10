// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

/**
 * @typedef WasmId
 * @type {object}
 * @property {string} idStr - full object id string
 * @property {string} scheme - eg, object, valuetype, array ..
 * @property {string} value - string part after `dotnet:scheme:` of the id string
 * @property {object} o - value parsed as JSON
 */

/**
 * @typedef WasmRoot - a single address in the managed heap, visible to the GC
 * @type {object}
 * @property {ManagedPointer} value - pointer into the managed heap, stored in the root
 * @property {function} get_address - retrieves address of the root in wasm memory
 * @property {function} get - retrieves pointer value
 * @property {function} set - updates the pointer
 * @property {function} release - releases the root storage for future use
 */

/**
 * @typedef WasmRootBuffer - a collection of addresses in the managed heap, visible to the GC
 * @type {object}
 * @property {number} length - number of elements the root buffer can hold
 * @property {function} get_address - retrieves address of an element in wasm memory, by index
 * @property {function} get - retrieves an element by index
 * @property {function} set - sets an element's value by index
 * @property {function} release - releases the root storage for future use
 */

/**
 * @typedef ManagedPointer
 * @type {number} - address in the managed heap
 */

/**
 * @typedef NativePointer
 * @type {number} - address in wasm memory
 */

/**
 * @typedef Event
 * @type {object}
 * @property {string} eventName - name of the event being raised
 * @property {object} eventArgs - arguments for the event itself
 */

var MonoSupportLib = {
	$MONO__postset: 'MONO.export_functions (Module);',
	$MONO: {
		pump_count: 0,
		timeout_queue: [],
		spread_timers_maximum:0,
		_vt_stack: [],
		mono_wasm_runtime_is_ready : false,
		mono_wasm_ignore_pdb_load_errors: true,

		/** @type {object.<string, object>} */
		_id_table: {},

		pump_message: function () {
			if (!this.mono_background_exec)
				this.mono_background_exec = Module.cwrap ("mono_background_exec", null);
			while (MONO.timeout_queue.length > 0) {
				--MONO.pump_count;
				MONO.timeout_queue.shift()();
			}
			while (MONO.pump_count > 0) {
				--MONO.pump_count;
				this.mono_background_exec ();
			}
		},

		export_functions: function (module) {
			module ["pump_message"] = MONO.pump_message.bind(MONO);
			module ["prevent_timer_throttling"] = MONO.prevent_timer_throttling.bind(MONO);
			module ["mono_wasm_set_timeout_exec"] = MONO.mono_wasm_set_timeout_exec.bind(MONO);
			module ["mono_load_runtime_and_bcl"] = MONO.mono_load_runtime_and_bcl.bind(MONO);
			module ["mono_load_runtime_and_bcl_args"] = MONO.mono_load_runtime_and_bcl_args.bind(MONO);
			module ["mono_wasm_load_bytes_into_heap"] = MONO.mono_wasm_load_bytes_into_heap.bind(MONO);
			module ["mono_wasm_load_icu_data"] = MONO.mono_wasm_load_icu_data.bind(MONO);
			module ["mono_wasm_get_icudt_name"] = MONO.mono_wasm_get_icudt_name.bind(MONO);
			module ["mono_wasm_globalization_init"] = MONO.mono_wasm_globalization_init.bind(MONO);
			module ["mono_wasm_get_loaded_files"] = MONO.mono_wasm_get_loaded_files.bind(MONO);
			module ["mono_wasm_new_root_buffer"] = MONO.mono_wasm_new_root_buffer.bind(MONO);
			module ["mono_wasm_new_root_buffer_from_pointer"] = MONO.mono_wasm_new_root_buffer_from_pointer.bind(MONO);
			module ["mono_wasm_new_root"] = MONO.mono_wasm_new_root.bind(MONO);
			module ["mono_wasm_new_roots"] = MONO.mono_wasm_new_roots.bind(MONO);
			module ["mono_wasm_release_roots"] = MONO.mono_wasm_release_roots.bind(MONO);
			module ["mono_wasm_load_config"] = MONO.mono_wasm_load_config.bind(MONO);
		},

		_base64Converter: {
			// Code from JSIL:
			// https://github.com/sq/JSIL/blob/1d57d5427c87ab92ffa3ca4b82429cd7509796ba/JSIL.Libraries/Includes/Bootstrap/Core/Classes/System.Convert.js#L149
			// Thanks to Katelyn Gadd @kg

			_base64Table: [
				'A', 'B', 'C', 'D',
				'E', 'F', 'G', 'H',
				'I', 'J', 'K', 'L',
				'M', 'N', 'O', 'P',
				'Q', 'R', 'S', 'T',
				'U', 'V', 'W', 'X',
				'Y', 'Z',
				'a', 'b', 'c', 'd',
				'e', 'f', 'g', 'h',
				'i', 'j', 'k', 'l',
				'm', 'n', 'o', 'p',
				'q', 'r', 's', 't',
				'u', 'v', 'w', 'x',
				'y', 'z',
				'0', '1', '2', '3',
				'4', '5', '6', '7',
				'8', '9',
				'+', '/'
			],

			_makeByteReader: function (bytes, index, count) {
				var position = (typeof (index) === "number") ? index : 0;
				var endpoint;

				if (typeof (count) === "number")
					endpoint = (position + count);
				else
					endpoint = (bytes.length - position);

				var result = {
					read: function () {
						if (position >= endpoint)
							return false;

						var nextByte = bytes[position];
						position += 1;
						return nextByte;
					}
				};

				Object.defineProperty(result, "eof", {
					get: function () {
						return (position >= endpoint);
					},
					configurable: true,
					enumerable: true
				});

				return result;
			},

			toBase64StringImpl: function (inArray, offset, length) {
				var reader = this._makeByteReader(inArray, offset, length);
				var result = "";
				var ch1 = 0, ch2 = 0, ch3 = 0, bits = 0, equalsCount = 0, sum = 0;
				var mask1 = (1 << 24) - 1, mask2 = (1 << 18) - 1, mask3 = (1 << 12) - 1, mask4 = (1 << 6) - 1;
				var shift1 = 18, shift2 = 12, shift3 = 6, shift4 = 0;

				while (true) {
					ch1 = reader.read();
					ch2 = reader.read();
					ch3 = reader.read();

					if (ch1 === false)
						break;
					if (ch2 === false) {
						ch2 = 0;
						equalsCount += 1;
					}
					if (ch3 === false) {
						ch3 = 0;
						equalsCount += 1;
					}

					// Seems backwards, but is right!
					sum = (ch1 << 16) | (ch2 << 8) | (ch3 << 0);

					bits = (sum & mask1) >> shift1;
					result += this._base64Table[bits];
					bits = (sum & mask2) >> shift2;
					result += this._base64Table[bits];

					if (equalsCount < 2) {
						bits = (sum & mask3) >> shift3;
						result += this._base64Table[bits];
					}

					if (equalsCount === 2) {
						result += "==";
					} else if (equalsCount === 1) {
						result += "=";
					} else {
						bits = (sum & mask4) >> shift4;
						result += this._base64Table[bits];
					}
				}

				return result;
			},
		},

		_mono_wasm_root_buffer_prototype: {
			_throw_index_out_of_range: function () {
				throw new Error ("index out of range");
			},
			_check_in_range: function (index) {
				if ((index >= this.__count) || (index < 0))
					this._throw_index_out_of_range();
			},
			/** @returns {NativePointer} */
			get_address: function (index) {
				this._check_in_range (index);
				return this.__offset + (index * 4);
			},
			/** @returns {number} */
			get_address_32: function (index) {
				this._check_in_range (index);
				return this.__offset32 + index;
			},
			/** @returns {ManagedPointer} */
			get: function (index) {
				this._check_in_range (index);
				return Module.HEAP32[this.get_address_32 (index)];
			},
			set: function (index, value) {
				Module.HEAP32[this.get_address_32 (index)] = value;
				return value;
			},
			_unsafe_get: function (index) {
				return Module.HEAP32[this.__offset32 + index];
			},
			_unsafe_set: function (index, value) {
				Module.HEAP32[this.__offset32 + index] = value;
			},
			clear: function () {
				if (this.__offset)
					MONO._zero_region (this.__offset, this.__count * 4);
			},
			release: function () {
				if (this.__offset && this.__ownsAllocation) {
					MONO.mono_wasm_deregister_root (this.__offset);
					MONO._zero_region (this.__offset, this.__count * 4);
					Module._free (this.__offset);
				}

				this.__handle = this.__offset = this.__count = this.__offset32 = 0;
			},
			toString: function () {
				return "[root buffer @" + this.get_address (0) + ", size " + this.__count + "]";
			}
		},

		_scratch_root_buffer: null,
		_scratch_root_free_indices: null,
		_scratch_root_free_indices_count: 0,
		_scratch_root_free_instances: [],

		_mono_wasm_root_prototype: {
			/** @returns {NativePointer} */
			get_address: function () {
				return this.__buffer.get_address (this.__index);
			},
			/** @returns {number} */
			get_address_32: function () {
				return this.__buffer.get_address_32 (this.__index);
			},
			/** @returns {ManagedPointer} */
			get: function () {
				var result = this.__buffer._unsafe_get (this.__index);
				return result;
			},
			set: function (value) {
				this.__buffer._unsafe_set (this.__index, value);
				return value;
			},
			/** @returns {ManagedPointer} */
			valueOf: function () {
				return this.get ();
			},
			clear: function () {
				this.set (0);
			},
			release: function () {
				const maxPooledInstances = 128;
				if (MONO._scratch_root_free_instances.length > maxPooledInstances) {
					MONO._mono_wasm_release_scratch_index (this.__index);
					this.__buffer = 0;
					this.__index = 0;
				} else {
					this.set (0);
					MONO._scratch_root_free_instances.push (this);
				}
			},
			toString: function () {
				return "[root @" + this.get_address () + "]";
			}
		},

		_mono_wasm_release_scratch_index: function (index) {
			if (index === undefined)
				return;

			this._scratch_root_buffer.set (index, 0);
			this._scratch_root_free_indices[this._scratch_root_free_indices_count] = index;
			this._scratch_root_free_indices_count++;
		},

		_mono_wasm_claim_scratch_index: function () {
			if (!this._scratch_root_buffer) {
				const maxScratchRoots = 8192;
				this._scratch_root_buffer = this.mono_wasm_new_root_buffer (maxScratchRoots, "js roots");

				this._scratch_root_free_indices = new Int32Array (maxScratchRoots);
				this._scratch_root_free_indices_count = maxScratchRoots;
				for (var i = 0; i < maxScratchRoots; i++)
					this._scratch_root_free_indices[i] = maxScratchRoots - i - 1;

				Object.defineProperty (this._mono_wasm_root_prototype, "value", {
					get: this._mono_wasm_root_prototype.get,
					set: this._mono_wasm_root_prototype.set,
					configurable: false
				});
			}

			if (this._scratch_root_free_indices_count < 1)
				throw new Error ("Out of scratch root space");

			var result = this._scratch_root_free_indices[this._scratch_root_free_indices_count - 1];
			this._scratch_root_free_indices_count--;
			return result;
		},

		_zero_region: function (byteOffset, sizeBytes) {
			if (((byteOffset % 4) === 0) && ((sizeBytes % 4) === 0))
				Module.HEAP32.fill(0, byteOffset / 4, sizeBytes / 4);
			else
				Module.HEAP8.fill(0, byteOffset, sizeBytes);
		},

		/**
		 * Allocates a block of memory that can safely contain pointers into the managed heap.
		 * The result object has get(index) and set(index, value) methods that can be used to retrieve and store managed pointers.
		 * Once you are done using the root buffer, you must call its release() method.
		 * For small numbers of roots, it is preferable to use the mono_wasm_new_root and mono_wasm_new_roots APIs instead.
		 * @param {number} capacity - the maximum number of elements the buffer can hold.
		 * @param {string} [msg] - a description of the root buffer (for debugging)
		 * @returns {WasmRootBuffer}
		 */
		mono_wasm_new_root_buffer: function (capacity, msg) {
			if (!this.mono_wasm_register_root || !this.mono_wasm_deregister_root) {
				this.mono_wasm_register_root = Module.cwrap ("mono_wasm_register_root", "number", ["number", "number", "string"]);
				this.mono_wasm_deregister_root = Module.cwrap ("mono_wasm_deregister_root", null, ["number"]);
			}

			if (capacity <= 0)
				throw new Error ("capacity >= 1");

			capacity = capacity | 0;

			var capacityBytes = capacity * 4;
			var offset = Module._malloc (capacityBytes);
			if ((offset % 4) !== 0)
				throw new Error ("Malloc returned an unaligned offset");

			this._zero_region (offset, capacityBytes);

			var result = Object.create (this._mono_wasm_root_buffer_prototype);
			result.__offset = offset;
			result.__offset32 = (offset / 4) | 0;
			result.__count = capacity;
			result.length = capacity;
			result.__handle = this.mono_wasm_register_root (offset, capacityBytes, msg || 0);
			result.__ownsAllocation = true;

			return result;
		},

		/**
		 * Creates a root buffer object representing an existing allocation in the native heap and registers
		 *  the allocation with the GC. The caller is responsible for managing the lifetime of the allocation.
		 * @param {NativePointer} offset - the offset of the root buffer in the native heap.
		 * @param {number} capacity - the maximum number of elements the buffer can hold.
		 * @param {string} [msg] - a description of the root buffer (for debugging)
		 * @returns {WasmRootBuffer}
		 */
		mono_wasm_new_root_buffer_from_pointer: function (offset, capacity, msg) {
			if (!this.mono_wasm_register_root || !this.mono_wasm_deregister_root) {
				this.mono_wasm_register_root = Module.cwrap ("mono_wasm_register_root", "number", ["number", "number", "string"]);
				this.mono_wasm_deregister_root = Module.cwrap ("mono_wasm_deregister_root", null, ["number"]);
			}

			if (capacity <= 0)
				throw new Error ("capacity >= 1");

			capacity = capacity | 0;

			var capacityBytes = capacity * 4;
			if ((offset % 4) !== 0)
				throw new Error ("Unaligned offset");

			this._zero_region (offset, capacityBytes);

			var result = Object.create (this._mono_wasm_root_buffer_prototype);
			result.__offset = offset;
			result.__offset32 = (offset / 4) | 0;
			result.__count = capacity;
			result.length = capacity;
			result.__handle = this.mono_wasm_register_root (offset, capacityBytes, msg || 0);
			result.__ownsAllocation = false;

			return result;
		},

		/**
		 * Allocates temporary storage for a pointer into the managed heap.
		 * Pointers stored here will be visible to the GC, ensuring that the object they point to aren't moved or collected.
		 * If you already have a managed pointer you can pass it as an argument to initialize the temporary storage.
		 * The result object has get() and set(value) methods, along with a .value property.
		 * When you are done using the root you must call its .release() method.
		 * @param {ManagedPointer} [value] - an address in the managed heap to initialize the root with (or 0)
		 * @returns {WasmRoot}
		 */
		mono_wasm_new_root: function (value) {
			var result;

			if (this._scratch_root_free_instances.length > 0) {
				result = this._scratch_root_free_instances.pop ();
			} else {
				var index = this._mono_wasm_claim_scratch_index ();
				var buffer = this._scratch_root_buffer;

				result = Object.create (this._mono_wasm_root_prototype);
				result.__buffer = buffer;
				result.__index = index;
			}

			if (value !== undefined) {
				if (typeof (value) !== "number")
					throw new Error ("value must be an address in the managed heap");

				result.set (value);
			} else {
				result.set (0);
			}

			return result;
		},

		/**
		 * Allocates 1 or more temporary roots, accepting either a number of roots or an array of pointers.
		 * mono_wasm_new_roots(n): returns an array of N zero-initialized roots.
		 * mono_wasm_new_roots([a, b, ...]) returns an array of new roots initialized with each element.
		 * Each root must be released with its release method, or using the mono_wasm_release_roots API.
		 * @param {(number | ManagedPointer[])} count_or_values - either a number of roots or an array of pointers
		 * @returns {WasmRoot[]}
		 */
		mono_wasm_new_roots: function (count_or_values) {
			var result;

			if (Array.isArray (count_or_values)) {
				result = new Array (count_or_values.length);
				for (var i = 0; i < result.length; i++)
					result[i] = this.mono_wasm_new_root (count_or_values[i]);
			} else if ((count_or_values | 0) > 0) {
				result = new Array (count_or_values);
				for (var i = 0; i < result.length; i++)
					result[i] = this.mono_wasm_new_root ();
			} else {
				throw new Error ("count_or_values must be either an array or a number greater than 0");
			}

			return result;
		},

		/**
		 * Releases 1 or more root or root buffer objects.
		 * Multiple objects may be passed on the argument list.
		 * 'undefined' may be passed as an argument so it is safe to call this method from finally blocks
		 *  even if you are not sure all of your roots have been created yet.
		 * @param {... WasmRoot} roots
		 */
		mono_wasm_release_roots: function () {
			for (var i = 0; i < arguments.length; i++) {
				if (!arguments[i])
					continue;

				arguments[i].release ();
			}
		},

		mono_text_decoder: undefined,
		string_decoder: {
			copy: function (mono_string) {
				if (mono_string === 0)
					return null;

				if (!this.mono_wasm_string_root)
					this.mono_wasm_string_root = MONO.mono_wasm_new_root ();
				this.mono_wasm_string_root.value = mono_string;

				if (!this.mono_wasm_string_get_data)
					this.mono_wasm_string_get_data = Module.cwrap ("mono_wasm_string_get_data", null, ['number', 'number', 'number', 'number']);
				
				if (!this.mono_wasm_string_decoder_buffer)
					this.mono_wasm_string_decoder_buffer = Module._malloc(12);
				
				let ppChars = this.mono_wasm_string_decoder_buffer + 0,
					pLengthBytes = this.mono_wasm_string_decoder_buffer + 4,
					pIsInterned = this.mono_wasm_string_decoder_buffer + 8;
				
				this.mono_wasm_string_get_data (mono_string, ppChars, pLengthBytes, pIsInterned);

				// TODO: Is this necessary?
				if (!this.mono_wasm_empty_string)
					this.mono_wasm_empty_string = "";

				let result = this.mono_wasm_empty_string;
				let lengthBytes = Module.HEAP32[pLengthBytes / 4],
					pChars = Module.HEAP32[ppChars / 4],
					isInterned = Module.HEAP32[pIsInterned / 4];

				if (pLengthBytes && pChars) {
					if (
						isInterned && 
						MONO.interned_string_table && 
						MONO.interned_string_table.has(mono_string)
					) {
						result = MONO.interned_string_table.get(mono_string);
						// console.log("intern table cache hit", mono_string, result.length);
					} else {
						result = this.decode(pChars, pChars + lengthBytes, false);
						if (isInterned) {
							if (!MONO.interned_string_table)
								MONO.interned_string_table = new Map();
							// console.log("interned", mono_string, result.length);
							MONO.interned_string_table.set(mono_string, result);
						}
					}						
				}

				this.mono_wasm_string_root.value = 0;
				return result;
			},
			decode: function (start, end, save) {
				if (!MONO.mono_text_decoder) {
					MONO.mono_text_decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
				}

				var str = "";
				if (MONO.mono_text_decoder) {
					// When threading is enabled, TextDecoder does not accept a view of a
					// SharedArrayBuffer, we must make a copy of the array first.
					var subArray = typeof SharedArrayBuffer !== 'undefined' && Module.HEAPU8.buffer instanceof SharedArrayBuffer
						? Module.HEAPU8.slice(start, end)
						: Module.HEAPU8.subarray(start, end);

					str = MONO.mono_text_decoder.decode(subArray);
				} else {
					for (var i = 0; i < end - start; i+=2) {
						var char = Module.getValue (start + i, 'i16');
						str += String.fromCharCode (char);
					}
				}
				if (save)
					this.result = str;

				return str;
			},
		},

		mono_wasm_add_dbg_command_received: function(res_ok, id, buffer, buffer_len) 
		{
			const assembly_data = new Uint8Array(Module.HEAPU8.buffer, buffer, buffer_len);
			const base64String = MONO._base64Converter.toBase64StringImpl(assembly_data);
			const buffer_obj = {
				res_ok,
				res: {
						id,
						value: base64String
				}
			}
			if (MONO.commands_received.has(id))
        		console.warn("Addind an id that already exists in commands_received");
			MONO.commands_received.set(id, buffer_obj);
		},

		mono_wasm_malloc_and_set_debug_buffer: function (command_parameters)
		{
			if (command_parameters.length > this._debugger_buffer_len)
			{
				if (this._debugger_buffer)
					Module._free (this._debugger_buffer);
				this._debugger_buffer_len = Math.max(command_parameters.length, this._debugger_buffer_len, 256);
				this._debugger_buffer = Module._malloc (this._debugger_buffer_len);
			}
			this._debugger_heap_bytes = new Uint8Array (Module.HEAPU8.buffer, this._debugger_buffer, this._debugger_buffer_len);
			this._debugger_heap_bytes.set(this._base64_to_uint8 (command_parameters));
		},

		mono_wasm_send_dbg_command_with_parms: function (id, command_set, command, command_parameters, length, valtype, newvalue)
		{
			this.mono_wasm_malloc_and_set_debug_buffer(command_parameters);
			this._c_fn_table.mono_wasm_send_dbg_command_with_parms_wrapper (id, command_set, command, this._debugger_buffer, length, valtype, newvalue.toString());
			let { res_ok, res } =  MONO.commands_received.remove(id);;
			if (!res_ok)
				throw new Error (`Failed on mono_wasm_invoke_method_debugger_agent_with_parms`);
			return res;
		},

		mono_wasm_send_dbg_command: function (id, command_set, command, command_parameters)
		{
			this.mono_wasm_malloc_and_set_debug_buffer(command_parameters);
			this._c_fn_table.mono_wasm_send_dbg_command_wrapper (id, command_set, command, this._debugger_buffer, command_parameters.length);
			let { res_ok, res } =  MONO.commands_received.remove(id);
			if (!res_ok)
				throw new Error (`Failed on mono_wasm_send_dbg_command`);
			return res;

		},

		mono_wasm_get_dbg_command_info: function ()
		{
			let { res_ok, res } =  MONO.commands_received.remove(0);
			if (!res_ok)
				throw new Error (`Failed on mono_wasm_get_dbg_command_info`);
			return res;
		},

		_get_cfo_res_details: function (objectId, args) {
			if (!(objectId in this._call_function_res_cache))
				throw new Error(`Could not find any object with id ${objectId}`);

			const real_obj = this._call_function_res_cache [objectId];

			const descriptors = Object.getOwnPropertyDescriptors (real_obj);
			if (args.accessorPropertiesOnly) {
				Object.keys (descriptors).forEach (k => {
					if (descriptors [k].get === undefined)
						Reflect.deleteProperty (descriptors, k);
				});
			}

			let res_details = [];
			Object.keys (descriptors).forEach (k => {
				let new_obj;
				let prop_desc = descriptors [k];
				if (typeof prop_desc.value == "object") {
					// convert `{value: { type='object', ... }}`
					// to      `{ name: 'foo', value: { type='object', ... }}
					new_obj = Object.assign ({ name: k }, prop_desc);
				} else if (prop_desc.value !== undefined) {
					// This is needed for values that were not added by us,
					// thus are like { value: 5 }
					// instead of    { value: { type = 'number', value: 5 }}
					//
					// This can happen, for eg., when `length` gets added for arrays
					// or `__proto__`.
					new_obj = {
						name: k,
						// merge/add `type` and `description` to `d.value`
						value: Object.assign ({ type: (typeof prop_desc.value), description: '' + prop_desc.value },
												prop_desc)
					};
				} else if (prop_desc.get !== undefined) {
					// The real_obj has the actual getter. We are just returning a placeholder
					// If the caller tries to run function on the cfo_res object,
					// that accesses this property, then it would be run on `real_obj`,
					// which *has* the original getter
					new_obj = {
						name: k,
						get: {
							className: "Function",
							description: `get ${k} () {}`,
							type: "function"
						}
					};
				} else {
					new_obj = { name: k, value: { type: "symbol", value: "<Unknown>", description: "<Unknown>"} };
				}

				res_details.push (new_obj);
			});

			return { __value_as_json_string__: JSON.stringify (res_details) };
		},

		mono_wasm_get_details: function (objectId, args={}) {
				return this._get_cfo_res_details (`dotnet:cfo_res:${objectId}`, args);
		},

		_cache_call_function_res: function (obj) {
			const id = `dotnet:cfo_res:${this._next_call_function_res_id++}`;
			this._call_function_res_cache[id] = obj;
			return id;
		},

		mono_wasm_release_object: function (objectId) {
			if (objectId in this._cache_call_function_res)
				delete this._cache_call_function_res[objectId];
		},

		_create_proxy_from_object_id: function (objectId, details) {
			if (objectId.startsWith ('dotnet:array:'))
			{
				if (details.items === undefined)
				{
					const ret = details.map (p => p.value);
					return ret;
				}
				if (details.dimensionsDetails == undefined || details.dimensionsDetails.length == 1)
				{
					const ret = details.items.map (p => p.value);
					return ret;
				}
			}

			let proxy = {};
			Object.keys (details).forEach (p => {
				var prop = details [p];
				if (prop.get !== undefined) {
					Object.defineProperty (proxy,
							prop.name,
							{ get () { return MONO.mono_wasm_send_dbg_command(prop.get.id, prop.get.commandSet, prop.get.command, prop.get.buffer, prop.get.length); },
							set: function (newValue) { MONO.mono_wasm_send_dbg_command_with_parms(prop.set.id, prop.set.commandSet, prop.set.command, prop.set.buffer, prop.set.length, prop.set.valtype, newValue); return true;}}
					);
				} else if (prop.set !== undefined ){
					Object.defineProperty (proxy,
						prop.name,
						{ get () { return prop.value; },
						  set: function (newValue) { MONO.mono_wasm_send_dbg_command_with_parms(prop.set.id, prop.set.commandSet, prop.set.command, prop.set.buffer, prop.set.length, prop.set.valtype, newValue); return true;}}
					);
				} else {
					proxy [prop.name] = prop.value;
				}
			});
			return proxy;
		},

		mono_wasm_call_function_on: function (request) {
			if (request.arguments != undefined && !Array.isArray (request.arguments))
				throw new Error (`"arguments" should be an array, but was ${request.arguments}`);

			const objId = request.objectId;
			const details = request.details;
			let proxy;

			if (objId.startsWith ('dotnet:cfo_res:')) {
				if (objId in this._call_function_res_cache)
					proxy = this._call_function_res_cache [objId];
				else
					throw new Error (`Unknown object id ${objId}`);
			} else {
				proxy = this._create_proxy_from_object_id (objId, details);
			}

			const fn_args = request.arguments != undefined ? request.arguments.map(a => JSON.stringify(a.value)) : [];
			const fn_eval_str = `var fn = ${request.functionDeclaration}; fn.call (proxy, ...[${fn_args}]);`;

			const fn_res = eval (fn_eval_str);
			if (fn_res === undefined)
				return { type: "undefined" };

			if (Object (fn_res) !== fn_res)
			{
				if (typeof(fn_res) == "object" && fn_res == null)
					return { type: typeof(fn_res), subtype: `${fn_res}`, value: null };
				return { type: typeof(fn_res), description: `${fn_res}`, value: `${fn_res}`};
			}

			if (request.returnByValue && fn_res.subtype == undefined)
				return {type: "object", value: fn_res};
			if (Object.getPrototypeOf (fn_res) == Array.prototype) {

				const fn_res_id = this._cache_call_function_res (fn_res);

				return {
					type: "object",
					subtype: "array",
					className: "Array",
					description: `Array(${fn_res.length})`,
					objectId: fn_res_id
				};
			}
			if (fn_res.value !== undefined || fn_res.subtype !== undefined) {
				return fn_res;
			}

			if (fn_res == proxy)
				return { type: "object", className: "Object", description: "Object", objectId: objId };
			const fn_res_id = this._cache_call_function_res (fn_res);
			return { type: "object", className: "Object", description: "Object", objectId: fn_res_id };
		},

		_clear_per_step_state: function () {
			this._next_id_var = 0;
			this._id_table = {};
		},

		mono_wasm_debugger_resume: function () {
			this._clear_per_step_state ();
		},

		mono_wasm_detach_debugger: function () {
			if (!this.mono_wasm_set_is_debugger_attached)
				this.mono_wasm_set_is_debugger_attached = Module.cwrap ('mono_wasm_set_is_debugger_attached', 'void', ['bool']);
			this.mono_wasm_set_is_debugger_attached(false);
		},

		_register_c_fn: function (name, ...args) {
			Object.defineProperty (this._c_fn_table, name + '_wrapper', { value: Module.cwrap (name, ...args) });
		},

		/**
		 * Calls `Module.cwrap` for the function name,
		 * and creates a wrapper around it that returns
		 *     `{ bool result, object var_info }
		 *
		 * @param  {string} name C function name
		 * @param  {string} ret_type
		 * @param  {string[]} params
		 *
		 * @returns {void}
		 */
		_register_c_var_fn: function (name, ret_type, params) {
			if (ret_type !== 'bool')
				throw new Error (`Bug: Expected a C function signature that returns bool`);

			this._register_c_fn (name, ret_type, params);
			Object.defineProperty (this, name + '_info', {
				value: function (...args) {
					MONO.var_info = [];
					const res_ok = MONO._c_fn_table [name + '_wrapper'] (...args);
					let res = MONO.var_info;
					MONO.var_info = [];
					if (res_ok) {
						res = this._fixup_name_value_objects (res);
						return { res_ok, res };
					}

					return { res_ok, res: undefined };
				}
			});
		},

		mono_wasm_runtime_ready: function () {
			MONO.commands_received = new Map();
			MONO.commands_received.remove = function (key) { const value = this.get(key); this.delete(key); return value;};
			this.mono_wasm_runtime_is_ready = true;
			this._clear_per_step_state ();

			// FIXME: where should this go?
			this._next_call_function_res_id = 0;
			this._call_function_res_cache = {};

			this._c_fn_table = {};
			this._register_c_fn     ('mono_wasm_send_dbg_command',							'bool', [ 'number', 'number', 'number', 'number', 'number' ]);
			this._register_c_fn     ('mono_wasm_send_dbg_command_with_parms', 				'bool', [ 'number', 'number', 'number', 'number', 'number', 'number', 'string' ]);
			this._debugger_buffer_len = -1;
			// DO NOT REMOVE - magic debugger init function
			if (globalThis.dotnetDebugger)
				debugger;
			else
				console.debug ("mono_wasm_runtime_ready", "fe00e07a-5519-4dfe-b35a-f867dbaf2e28");
		},

		// Set environment variable NAME to VALUE
		// Should be called before mono_load_runtime_and_bcl () in most cases
		mono_wasm_setenv: function (name, value) {
			if (!this.wasm_setenv)
				this.wasm_setenv = Module.cwrap ('mono_wasm_setenv', null, ['string', 'string']);
			this.wasm_setenv (name, value);
		},

		mono_wasm_set_runtime_options: function (options) {
			if (!this.wasm_parse_runtime_options)
				this.wasm_parse_runtime_options = Module.cwrap ('mono_wasm_parse_runtime_options', null, ['number', 'number']);
			var argv = Module._malloc (options.length * 4);
			var wasm_strdup = Module.cwrap ('mono_wasm_strdup', 'number', ['string']);
			let aindex = 0;
			for (var i = 0; i < options.length; ++i) {
				Module.setValue (argv + (aindex * 4), wasm_strdup (options [i]), "i32");
				aindex += 1;
			}
			this.wasm_parse_runtime_options (options.length, argv);
		},

		//
		// Initialize the AOT profiler with OPTIONS.
		// Requires the AOT profiler to be linked into the app.
		// options = { write_at: "<METHODNAME>", send_to: "<METHODNAME>" }
		// <METHODNAME> should be in the format <CLASS>::<METHODNAME>.
		// write_at defaults to 'WebAssembly.Runtime::StopProfile'.
		// send_to defaults to 'WebAssembly.Runtime::DumpAotProfileData'.
		// DumpAotProfileData stores the data into Module.aot_profile_data.
		//
		mono_wasm_init_aot_profiler: function (options) {
			if (options == null)
				options = {}
			if (!('write_at' in options))
				options.write_at = 'Interop/Runtime::StopProfile';
			if (!('send_to' in options))
				options.send_to = 'Interop/Runtime::DumpAotProfileData';
			var arg = "aot:write-at-method=" + options.write_at + ",send-to-method=" + options.send_to;
			Module.ccall ('mono_wasm_load_profiler_aot', null, ['string'], [arg]);
		},

		// options = { write_at: "<METHODNAME>", send_to: "<METHODNAME>" }
		// <METHODNAME> should be in the format <CLASS>::<METHODNAME>.
		// write_at defaults to 'WebAssembly.Runtime::StopProfile'.
		// send_to defaults to 'WebAssembly.Runtime::DumpCoverageProfileData'.
		// DumpCoverageProfileData stores the data into Module.coverage_profile_data.
		mono_wasm_init_coverage_profiler: function (options) {
			if (options == null)
				options = {}
			if (!('write_at' in options))
				options.write_at = 'WebAssembly.Runtime::StopProfile';
			if (!('send_to' in options))
				options.send_to = 'WebAssembly.Runtime::DumpCoverageProfileData';
			var arg = "coverage:write-at-method=" + options.write_at + ",send-to-method=" + options.send_to;
			Module.ccall ('mono_wasm_load_profiler_coverage', null, ['string'], [arg]);
		},

		_apply_configuration_from_args: function (args) {
			for (var k in (args.environment_variables || {}))
				MONO.mono_wasm_setenv (k, args.environment_variables[k]);

			if (args.runtime_options)
				MONO.mono_wasm_set_runtime_options (args.runtime_options);

			if (args.aot_profiler_options)
				MONO.mono_wasm_init_aot_profiler (args.aot_profiler_options);

			if (args.coverage_profiler_options)
				MONO.mono_wasm_init_coverage_profiler (args.coverage_profiler_options);
		},

		_get_fetch_file_cb_from_args: function (args) {
			if (typeof (args.fetch_file_cb) === "function")
				return args.fetch_file_cb;

			if (ENVIRONMENT_IS_NODE) {
				var fs = require('fs');
				return function (asset) {
					console.debug ("MONO_WASM: Loading... " + asset);
					var binary = fs.readFileSync (asset);
					var resolve_func2 = function (resolve, reject) {
						resolve (new Uint8Array (binary));
					};

					var resolve_func1 = function (resolve, reject) {
						var response = {
							ok: true,
							url: asset,
							arrayBuffer: function () {
								return new Promise (resolve_func2);
							}
						};
						resolve (response);
					};

					return new Promise (resolve_func1);
				};
			} else if (typeof (fetch) === "function") {
				return function (asset) {
					return fetch (asset, { credentials: 'same-origin' });
				};
			} else {
				throw new Error ("No fetch_file_cb was provided and this environment does not expose 'fetch'.");
			}
		},

		_handle_loaded_asset: function (ctx, asset, url, blob) {
			var bytes = new Uint8Array (blob);
			if (ctx.tracing)
				console.log ("MONO_WASM: Loaded:", asset.name, "size", bytes.length, "from", url);

			var virtualName = asset.virtual_path || asset.name;
			var offset = null;

			switch (asset.behavior) {
				case "resource":
				case "assembly":
					ctx.loaded_files.push ({ url: url, file: virtualName});
				case "heap":
				case "icu":
					offset = this.mono_wasm_load_bytes_into_heap (bytes);
					ctx.loaded_assets[virtualName] = [offset, bytes.length];
					break;

				case "vfs":
					// FIXME
					var lastSlash = virtualName.lastIndexOf("/");
					var parentDirectory = (lastSlash > 0)
						? virtualName.substr(0, lastSlash)
						: null;
					var fileName = (lastSlash > 0)
						? virtualName.substr(lastSlash + 1)
						: virtualName;
					if (fileName.startsWith("/"))
						fileName = fileName.substr(1);
					if (parentDirectory) {
						if (ctx.tracing)
							console.log ("MONO_WASM: Creating directory '" + parentDirectory + "'");

						var pathRet = ctx.createPath(
							"/", parentDirectory, true, true // fixme: should canWrite be false?
						);
					} else {
						parentDirectory = "/";
					}

					if (ctx.tracing)
						console.log ("MONO_WASM: Creating file '" + fileName + "' in directory '" + parentDirectory + "'");

					if (!this.mono_wasm_load_data_archive (bytes, parentDirectory)) {
						var fileRet = ctx.createDataFile (
							parentDirectory, fileName,
							bytes, true /* canRead */, true /* canWrite */, true /* canOwn */
						);
					}
					break;

				default:
					throw new Error ("Unrecognized asset behavior:", asset.behavior, "for asset", asset.name);
			}

			if (asset.behavior === "assembly") {
				var hasPpdb = ctx.mono_wasm_add_assembly (virtualName, offset, bytes.length);

				if (!hasPpdb) {
					var index = ctx.loaded_files.findIndex(element => element.file == virtualName);
					ctx.loaded_files.splice(index, 1);
				}
			}
			else if (asset.behavior === "icu") {
				if (this.mono_wasm_load_icu_data (offset))
					ctx.num_icu_assets_loaded_successfully += 1;
				else
					console.error ("Error loading ICU asset", asset.name);
			}
			else if (asset.behavior === "resource") {
				ctx.mono_wasm_add_satellite_assembly (virtualName, asset.culture, offset, bytes.length);
			}
		},

		// deprecated
		mono_load_runtime_and_bcl: function (
			unused_vfs_prefix, deploy_prefix, debug_level, file_list, loaded_cb, fetch_file_cb
		) {
			var args = {
				fetch_file_cb: fetch_file_cb,
				loaded_cb: loaded_cb,
				debug_level: debug_level,
				assembly_root: deploy_prefix,
				assets: []
			};

			for (var i = 0; i < file_list.length; i++) {
				var file_name = file_list[i];
				var behavior;
				if (file_name.startsWith ("icudt") && file_name.endsWith (".dat")) {
					// ICU data files are expected to be "icudt%FilterName%.dat"
					behavior = "icu";
				} else { // if (file_name.endsWith (".pdb") || file_name.endsWith (".dll"))
					behavior = "assembly";
				}

				args.assets.push ({
					name: file_name,
					behavior: behavior
				});
			}

			return this.mono_load_runtime_and_bcl_args (args);
		},

		// Initializes the runtime and loads assemblies, debug information, and other files.
		// @args is a dictionary-style Object with the following properties:
		//    assembly_root: (required) the subfolder containing managed assemblies and pdbs
		//    debug_level or enable_debugging: (required)
		//    assets: (required) a list of assets to load along with the runtime. each asset
		//     is a dictionary-style Object with the following properties:
		//        name: (required) the name of the asset, including extension.
		//        behavior: (required) determines how the asset will be handled once loaded:
		//          "heap": store asset into the native heap
		//          "assembly": load asset as a managed assembly (or debugging information)
		//          "resource": load asset as a managed resource assembly
		//          "icu": load asset as an ICU data archive
		//          "vfs": load asset into the virtual filesystem (for fopen, File.Open, etc)
		//        load_remote: (optional) if true, an attempt will be made to load the asset
		//          from each location in @args.remote_sources.
		//        virtual_path: (optional) if specified, overrides the path of the asset in
		//          the virtual filesystem and similar data structures once loaded.
		//        is_optional: (optional) if true, any failure to load this asset will be ignored.
		//    loaded_cb: (required) a function () invoked when loading has completed.
		//    fetch_file_cb: (optional) a function (string) invoked to fetch a given file.
		//      If no callback is provided a default implementation appropriate for the current
		//      environment will be selected (readFileSync in node, fetch elsewhere).
		//      If no default implementation is available this call will fail.
		//    remote_sources: (optional) additional search locations for assets.
		//      sources will be checked in sequential order until the asset is found.
		//      the string "./" indicates to load from the application directory (as with the
		//      files in assembly_list), and a fully-qualified URL like "https://example.com/" indicates
		//      that asset loads can be attempted from a remote server. Sources must end with a "/".
		//    environment_variables: (optional) dictionary-style Object containing environment variables
		//    runtime_options: (optional) array of runtime options as strings
		//    aot_profiler_options: (optional) dictionary-style Object. see the comments for
		//      mono_wasm_init_aot_profiler. If omitted, aot profiler will not be initialized.
		//    coverage_profiler_options: (optional) dictionary-style Object. see the comments for
		//      mono_wasm_init_coverage_profiler. If omitted, coverage profiler will not be initialized.
		//    globalization_mode: (optional) configures the runtime's globalization mode:
		//      "icu": load ICU globalization data from any runtime assets with behavior "icu".
		//      "invariant": operate in invariant globalization mode.
		//      "auto" (default): if "icu" behavior assets are present, use ICU, otherwise invariant.
		//    diagnostic_tracing: (optional) enables diagnostic log messages during startup
		mono_load_runtime_and_bcl_args: function (args) {
			try {
				return this._load_assets_and_runtime (args);
			} catch (exc) {
				console.error ("error in mono_load_runtime_and_bcl_args:", exc);
				throw exc;
			}
		},

		// @bytes must be a typed array. space is allocated for it in the native heap
		//  and it is copied to that location. returns the address of the allocation.
		mono_wasm_load_bytes_into_heap: function (bytes) {
			var memoryOffset = Module._malloc (bytes.length);
			var heapBytes = new Uint8Array (Module.HEAPU8.buffer, memoryOffset, bytes.length);
			heapBytes.set (bytes);
			return memoryOffset;
		},

		num_icu_assets_loaded_successfully: 0,

		// @offset must be the address of an ICU data archive in the native heap.
		// returns true on success.
		mono_wasm_load_icu_data: function (offset) {
			var fn = Module.cwrap ('mono_wasm_load_icu_data', 'number', ['number']);
			var ok = (fn (offset)) === 1;
			if (ok)
				this.num_icu_assets_loaded_successfully++;
			return ok;
		},

		// Get icudt.dat exact filename that matches given culture, examples:
		//   "ja" -> "icudt_CJK.dat"
		//   "en_US" (or "en-US" or just "en") -> "icudt_EFIGS.dat"
		// etc, see "mono_wasm_get_icudt_name" implementation in pal_icushim_static.c
		mono_wasm_get_icudt_name: function (culture) {
			return Module.ccall ('mono_wasm_get_icudt_name', 'string', ['string'], [culture]);
		},

		_finalize_startup: function (args, ctx) {
			var loaded_files_with_debug_info = [];

			MONO.loaded_assets = ctx.loaded_assets;
			ctx.loaded_files.forEach(value => loaded_files_with_debug_info.push(value.url));
			MONO.loaded_files = loaded_files_with_debug_info;
			if (ctx.tracing) {
				console.log ("MONO_WASM: loaded_assets: " + JSON.stringify(ctx.loaded_assets));
				console.log ("MONO_WASM: loaded_files: " + JSON.stringify(ctx.loaded_files));
			}

			var load_runtime = Module.cwrap ('mono_wasm_load_runtime', null, ['string', 'number']);

			console.debug ("MONO_WASM: Initializing mono runtime");

			this.mono_wasm_globalization_init (args.globalization_mode);

			if (ENVIRONMENT_IS_SHELL || ENVIRONMENT_IS_NODE) {
				try {
					load_runtime ("unused", args.debug_level);
				} catch (ex) {
					print ("MONO_WASM: load_runtime () failed: " + ex);
					print ("MONO_WASM: Stacktrace: \n");
					print (ex.stack);

					var wasm_exit = Module.cwrap ('mono_wasm_exit', null, ['number']);
					wasm_exit (1);
				}
			} else {
				load_runtime ("unused", args.debug_level);
			}

			let tz;
			try {
				tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			} catch {}
			MONO.mono_wasm_setenv ("TZ", tz || "UTC");
			MONO.mono_wasm_runtime_ready ();
			args.loaded_cb ();
		},

		_load_assets_and_runtime: function (args) {
			if (args.enable_debugging)
				args.debug_level = args.enable_debugging;
			if (args.assembly_list)
				throw new Error ("Invalid args (assembly_list was replaced by assets)");
			if (args.runtime_assets)
				throw new Error ("Invalid args (runtime_assets was replaced by assets)");
			if (args.runtime_asset_sources)
				throw new Error ("Invalid args (runtime_asset_sources was replaced by remote_sources)");
			if (!args.loaded_cb)
				throw new Error ("loaded_cb not provided");

			var ctx = {
				tracing: args.diagnostic_tracing || false,
				pending_count: args.assets.length,
				mono_wasm_add_assembly: Module.cwrap ('mono_wasm_add_assembly', 'number', ['string', 'number', 'number']),
				mono_wasm_add_satellite_assembly: Module.cwrap ('mono_wasm_add_satellite_assembly', 'void', ['string', 'string', 'number', 'number']),
				loaded_assets: Object.create (null),
				// dlls and pdbs, used by blazor and the debugger
				loaded_files: [],
				createPath: Module['FS_createPath'],
				createDataFile: Module['FS_createDataFile']
			};

			if (ctx.tracing)
				console.log ("mono_wasm_load_runtime_with_args", JSON.stringify(args));

			this._apply_configuration_from_args (args);

			var fetch_file_cb = this._get_fetch_file_cb_from_args (args);

			var onPendingRequestComplete = function () {
				--ctx.pending_count;

				if (ctx.pending_count === 0) {
					try {
						MONO._finalize_startup (args, ctx);
					} catch (exc) {
						console.error ("Unhandled exception in _finalize_startup", exc);
						throw exc;
					}
				}
			};

			var processFetchResponseBuffer = function (asset, url, blob) {
				try {
					MONO._handle_loaded_asset (ctx, asset, url, blob);
				} catch (exc) {
					console.error ("Unhandled exception in processFetchResponseBuffer", exc);
					throw exc;
				} finally {
					onPendingRequestComplete ();
				}
			};

			args.assets.forEach (function (asset) {
				var attemptNextSource;
				var sourceIndex = 0;
				var sourcesList = asset.load_remote ? args.remote_sources : [""];

				var handleFetchResponse = function (response) {
					if (!response.ok) {
						try {
							attemptNextSource ();
							return;
						} catch (exc) {
							console.error ("MONO_WASM: Unhandled exception in handleFetchResponse attemptNextSource for asset", asset.name, exc);
							throw exc;
						}
					}

					try {
						var bufferPromise = response ['arrayBuffer'] ();
						bufferPromise.then (processFetchResponseBuffer.bind (this, asset, response.url));
					} catch (exc) {
						console.error ("MONO_WASM: Unhandled exception in handleFetchResponse for asset", asset.name, exc);
						attemptNextSource ();
					}
				};

				attemptNextSource = function () {
					if (sourceIndex >= sourcesList.length) {
						var msg = "MONO_WASM: Failed to load " + asset.name;
						try {
							var isOk = asset.is_optional ||
								(asset.name.match (/\.pdb$/) && MONO.mono_wasm_ignore_pdb_load_errors);

							if (isOk)
								console.debug (msg);
							else {
								console.error (msg);
								throw new Error (msg);
							}
						} finally {
							onPendingRequestComplete ();
						}
					}

					var sourcePrefix = sourcesList[sourceIndex];
					sourceIndex++;

					// HACK: Special-case because MSBuild doesn't allow "" as an attribute
					if (sourcePrefix === "./")
						sourcePrefix = "";

					var attemptUrl;
					if (sourcePrefix.trim() === "") {
						if (asset.behavior === "assembly")
							attemptUrl = locateFile (args.assembly_root + "/" + asset.name);
						else if (asset.behavior === "resource") {
							var path = asset.culture !== '' ? `${asset.culture}/${asset.name}` : asset.name;
							attemptUrl = locateFile (args.assembly_root + "/" + path);
						}
						else
							attemptUrl = asset.name;
					} else {
						attemptUrl = sourcePrefix + asset.name;
					}

					try {
						if (asset.name === attemptUrl) {
							if (ctx.tracing)
								console.log ("Attempting to fetch '%s'", attemptUrl);
						} else {
							if (ctx.tracing)
								console.log ("Attempting to fetch '%s' for '%s'", attemptUrl, asset.name);
						}
						var fetch_promise = fetch_file_cb (attemptUrl);
						fetch_promise.then (handleFetchResponse);
					} catch (exc) {
						console.error ("MONO_WASM: Error fetching '%s'\n%s", attemptUrl, exc);
						attemptNextSource ();
					}
				};

				attemptNextSource ();
			});
		},

		// Performs setup for globalization.
		// @globalization_mode is one of "icu", "invariant", or "auto".
		// "auto" will use "icu" if any ICU data archives have been loaded,
		//  otherwise "invariant".
		mono_wasm_globalization_init: function (globalization_mode) {
			var invariantMode = false;

			if (globalization_mode === "invariant")
				invariantMode = true;

			if (!invariantMode) {
				if (this.num_icu_assets_loaded_successfully > 0) {
					console.debug ("MONO_WASM: ICU data archive(s) loaded, disabling invariant mode");
				} else if (globalization_mode !== "icu") {
					console.debug ("MONO_WASM: ICU data archive(s) not loaded, using invariant globalization mode");
					invariantMode = true;
				} else {
					var msg = "invariant globalization mode is inactive and no ICU data archives were loaded";
					console.error ("MONO_WASM: ERROR: " + msg);
					throw new Error (msg);
				}
			}

			if (invariantMode)
				this.mono_wasm_setenv ("DOTNET_SYSTEM_GLOBALIZATION_INVARIANT", "1");

			// Set globalization mode to PredefinedCulturesOnly
			this.mono_wasm_setenv ("DOTNET_SYSTEM_GLOBALIZATION_PREDEFINED_CULTURES_ONLY", "1");
		},

		// Used by the debugger to enumerate loaded dlls and pdbs
		mono_wasm_get_loaded_files: function() {
			if (!this.mono_wasm_set_is_debugger_attached)
				this.mono_wasm_set_is_debugger_attached = Module.cwrap ('mono_wasm_set_is_debugger_attached', 'void', ['bool']);
			this.mono_wasm_set_is_debugger_attached (true);
			return MONO.loaded_files;
		},

		mono_wasm_get_loaded_asset_table: function() {
			return MONO.loaded_assets;
		},

		// FIXME: improve
		_base64_to_uint8: function (base64String) {
			const byteCharacters = atob (base64String);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}

			return new Uint8Array (byteNumbers);
		},

		mono_wasm_load_data_archive: function (data, prefix) {
			if (data.length < 8)
				return false;

			var dataview = new DataView(data.buffer);
			var magic = dataview.getUint32(0, true);
			//	get magic number
			if (magic != 0x626c6174) {
				return false;
			}
			var manifestSize = dataview.getUint32(4, true);
			if (manifestSize == 0 || data.length < manifestSize + 8)
				return false;

			var manifest;
			try {
				manifestContent = Module.UTF8ArrayToString(data, 8, manifestSize);
				manifest = JSON.parse(manifestContent);
				if (!(manifest instanceof Array))
					return false;
			} catch (exc) {
				return false;
			}

			data = data.slice(manifestSize+8);

			// Create the folder structure
			// /usr/share/zoneinfo
			// /usr/share/zoneinfo/Africa
			// /usr/share/zoneinfo/Asia
			// ..

			var folders = new Set()
			manifest.filter(m => {
				var file = m[0];
				var last = file.lastIndexOf ("/");
				var directory = file.slice (0, last+1);
				folders.add(directory);
			});
			folders.forEach(folder => {
				Module['FS_createPath'](prefix, folder, true, true);
			});

			for (row of manifest) {
				var name = row[0];
				var length = row[1];
				var bytes = data.slice(0, length);
				Module['FS_createDataFile'](prefix, name, bytes, true, true);
				data = data.slice(length);
			}
			return true;
		},

		/**
		 * Raises an event for the debug proxy
		 *
		 * @param {Event} event - event to be raised
		 * @param {object} args - arguments for raising this event, eg. `{trace: true}`
		 */
		mono_wasm_raise_debug_event: function(event, args={}) {
			if (typeof event !== 'object')
				throw new Error(`event must be an object, but got ${JSON.stringify(event)}`);

			if (event.eventName === undefined)
				throw new Error(`event.eventName is a required parameter, in event: ${JSON.stringify(event)}`);

			if (typeof args !== 'object')
				throw new Error(`args must be an object, but got ${JSON.stringify(args)}`);

			console.debug('mono_wasm_debug_event_raised:aef14bca-5519-4dfe-b35a-f867abc123ae', JSON.stringify(event), JSON.stringify(args));
		},

		/**
		 * Loads the mono config file (typically called mono-config.json) asynchroniously
		 * Note: the run dependencies are so emsdk actually awaits it in order.
		 *
		 * @param {string} configFilePath - relative path to the config file
		 * @throws Will throw an error if the config file loading fails
		 */
		mono_wasm_load_config: async function (configFilePath) {
			Module.addRunDependency(configFilePath);	
			try {
				let config = null;
				// NOTE: when we add nodejs make sure to include the nodejs fetch package
				if (ENVIRONMENT_IS_WEB) {
					const configRaw = await fetch(configFilePath);
					config = await configRaw.json();
				}else if (ENVIRONMENT_IS_NODE) {
					config = require(configFilePath);
				} else { // shell or worker
					config = JSON.parse(read(configFilePath)); // read is a v8 debugger command
				}
				Module.config = config;
			} catch(e) {
				Module.config = {message: "failed to load config file", error: e};
			} finally {
				Module.removeRunDependency(configFilePath);
			}
		},
		mono_wasm_set_timeout_exec: function(id){
			if (!this.mono_set_timeout_exec)
				this.mono_set_timeout_exec = Module.cwrap ("mono_set_timeout_exec", null, [ 'number' ]);
			this.mono_set_timeout_exec (id);
		},
		prevent_timer_throttling: function () {
			// this will schedule timers every second for next 6 minutes, it should be called from WebSocket event, to make it work
			// on next call, it would only extend the timers to cover yet uncovered future
			let now = new Date().valueOf();
			const desired_reach_time = now + (1000 * 60 * 6);
			const next_reach_time = Math.max(now + 1000, this.spread_timers_maximum);
			const light_throttling_frequency = 1000;
			for (var schedule = next_reach_time; schedule < desired_reach_time; schedule += light_throttling_frequency) {
				const delay = schedule - now;
				setTimeout(() => {
					this.mono_wasm_set_timeout_exec(0);
					MONO.pump_count++;
					MONO.pump_message();
				}, delay);
			}
			this.spread_timers_maximum = desired_reach_time;
		}
	},
	schedule_background_exec: function () {
		++MONO.pump_count;
		if (typeof globalThis.setTimeout === 'function') {
			globalThis.setTimeout (MONO.pump_message, 0);
		}
	},

	mono_set_timeout: function (timeout, id) {

		if (typeof globalThis.setTimeout === 'function') {
			if (MONO.lastScheduleTimeoutId) {
				globalThis.clearTimeout(MONO.lastScheduleTimeoutId);
				MONO.lastScheduleTimeoutId = undefined;
			}
			MONO.lastScheduleTimeoutId = globalThis.setTimeout(function mono_wasm_set_timeout_exec () {
				MONO.mono_wasm_set_timeout_exec(id);
			}, timeout);
		} else {
			++MONO.pump_count;
			MONO.timeout_queue.push(function() {
				MONO.mono_wasm_set_timeout_exec (id);
			})
		}
	},

	mono_wasm_fire_debugger_agent_message: function () {
		// eslint-disable-next-line no-debugger
		debugger;
	},

	mono_wasm_asm_loaded: function (assembly_name, assembly_ptr, assembly_len, pdb_ptr, pdb_len) {
		// Only trigger this codepath for assemblies loaded after app is ready
		if (MONO.mono_wasm_runtime_is_ready !== true)
			return;

		const assembly_name_str = assembly_name !== 0 ? Module.UTF8ToString(assembly_name).concat('.dll') : '';

		const assembly_data = new Uint8Array(Module.HEAPU8.buffer, assembly_ptr, assembly_len);
		const assembly_b64 = MONO._base64Converter.toBase64StringImpl(assembly_data);

		let pdb_b64;
		if (pdb_ptr) {
			const pdb_data = new Uint8Array(Module.HEAPU8.buffer, pdb_ptr, pdb_len);
			pdb_b64 = MONO._base64Converter.toBase64StringImpl(pdb_data);
		}

		MONO.mono_wasm_raise_debug_event({
			eventName: 'AssemblyLoaded',
			assembly_name: assembly_name_str,
			assembly_b64,
			pdb_b64
		});
	}
};

autoAddDeps(MonoSupportLib, '$MONO')
mergeInto(LibraryManager.library, MonoSupportLib)

// SIG // Begin signature block
// SIG // MIIolwYJKoZIhvcNAQcCoIIoiDCCKIQCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // SVhV3F5GT7JSP81W6d5b/DaTHCFgFjSZTDKT88y2AzOg
// SIG // gg3wMIIGbjCCBFagAwIBAgITMwAAAo1+R8OCfgUaKgAA
// SIG // AAACjTANBgkqhkiG9w0BAQwFADB+MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBT
// SIG // aWduaW5nIFBDQSAyMDExMB4XDTIxMTAxNDE4NDUxNFoX
// SIG // DTIyMTAxMzE4NDUxNFowYzELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjENMAsGA1UEAxMELk5FVDCCAaIwDQYJKoZIhvcNAQEB
// SIG // BQADggGPADCCAYoCggGBAM+nYwbxkHhF3CQTxhfbfq0y
// SIG // Y9iNmf+vpsXyHr+W14sNKW2VmN48wwUttFgkElZWXDR7
// SIG // /LVrKRjN1wUWy/bzsFToydMsiIzNT1HUivMfeT/cykpT
// SIG // N/cVL/ZvvGrnhJeXQEn1xrnGNqW3ps0NjQQLPd2fvIy1
// SIG // Y/YAIh9r2+dHkYj+VjmEtv9v7r2jbtklWw6OFgOwkB8f
// SIG // GA+15Qiny+1dE5WvItLj/DGrPmCWz4MVgfG42ntE481F
// SIG // Ly4U74rBEDtaNahOtPUSS8yTjUeNIgi3eTkznStetnjg
// SIG // r+Bn0Io4KhMqkwA7cav5wxlORTU/OTdM6PVJrw6NKC6I
// SIG // ztKqeOjlFs26h1c5eBY6ZKIbBwNkDQuSq/P52gOjsTzh
// SIG // /s+9JPwbXzr/plrAXIXZh178HTrsr5gP9iaPXWIMDvlM
// SIG // Fw54saZB68Hh+D1XiAKmOvct4etdk8v8wlJ96O3j8S2o
// SIG // omSdqcALeycc7hVnpJ8j6hFVW9hXFRqSb9VYn18cMu5u
// SIG // 3WvIkQIDAQABo4IBfjCCAXowHwYDVR0lBBgwFgYKKwYB
// SIG // BAGCN0wIAQYIKwYBBQUHAwMwHQYDVR0OBBYEFB4HrzFI
// SIG // RagJ4H8x6Jocx6igXl7OMFAGA1UdEQRJMEekRTBDMSkw
// SIG // JwYDVQQLEyBNaWNyb3NvZnQgT3BlcmF0aW9ucyBQdWVy
// SIG // dG8gUmljbzEWMBQGA1UEBRMNNDY0MjIzKzQ2ODYyNjAf
// SIG // BgNVHSMEGDAWgBRIbmTlUAXTgqoXNzcitW2oynUClTBU
// SIG // BgNVHR8ETTBLMEmgR6BFhkNodHRwOi8vd3d3Lm1pY3Jv
// SIG // c29mdC5jb20vcGtpb3BzL2NybC9NaWNDb2RTaWdQQ0Ey
// SIG // MDExXzIwMTEtMDctMDguY3JsMGEGCCsGAQUFBwEBBFUw
// SIG // UzBRBggrBgEFBQcwAoZFaHR0cDovL3d3dy5taWNyb3Nv
// SIG // ZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNDb2RTaWdQQ0Ey
// SIG // MDExXzIwMTEtMDctMDguY3J0MAwGA1UdEwEB/wQCMAAw
// SIG // DQYJKoZIhvcNAQEMBQADggIBAB4qmkYG7kKK3A6/oZNe
// SIG // IP9JhNg7SX+VnacQGuwIHW2TxICObVUVh7Pq8m+xG9Ec
// SIG // o4Wl8AoArhOWnp3IMWFiF+vxGD7zaJpG77kxFXDewsA8
// SIG // PnehwnMfHq6TliI5/65+FZB4Kf5Ey16s2Qk6nTSq/bsg
// SIG // T572aCkU9hPd5WXukhRfuQOnWn6lRWREhcqAReuFmik5
// SIG // YD+hgJZgo3sCDc01hVEgOIdwgjXMENALrAgaQlp/QFRX
// SIG // +DMRpW96eyFoKFRWiRudBhtSqf9I+WmTgzK9QStgT8mn
// SIG // njaY70f8/dcqs0nv4wrWb438wT1xddyIrQXMnObYZCqb
// SIG // 7JDNTPfRpKpfAykwhRmAJDDvDn/zNmlz/vcaU4+WLtBV
// SIG // 2zpyk4oVcZzJgMWgGl3gdg8+fNAcLoQwfRqk+wYJccu+
// SIG // IX8lR0h+CygomPKALmxSb2ShJsU3BXXd6E135PgCkPsv
// SIG // x3ntyeorbcAshUOIaqJamTOdWkNf5X97QoTDEuPsS2tI
// SIG // zI3munvtDZ14nykyYjf4eX8NR6pAwOEgMrWQ14taSKq6
// SIG // MaXNucGaqCzFw/L+4p115iZbOo69+OuOhbVNB2tIZjeK
// SIG // YE7QKKU+lAdzgZUacya+Mg1Ku3ndGdvDB8IT735c3nU3
// SIG // 8LV8Ytut5jxvaiA1om3DNumfVNAITHgnJF8p7x1DzIA5
// SIG // Nax2MIIHejCCBWKgAwIBAgIKYQ6Q0gAAAAAAAzANBgkq
// SIG // hkiG9w0BAQsFADCBiDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEy
// SIG // MDAGA1UEAxMpTWljcm9zb2Z0IFJvb3QgQ2VydGlmaWNh
// SIG // dGUgQXV0aG9yaXR5IDIwMTEwHhcNMTEwNzA4MjA1OTA5
// SIG // WhcNMjYwNzA4MjEwOTA5WjB+MQswCQYDVQQGEwJVUzET
// SIG // MBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVk
// SIG // bW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
// SIG // aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWdu
// SIG // aW5nIFBDQSAyMDExMIICIjANBgkqhkiG9w0BAQEFAAOC
// SIG // Ag8AMIICCgKCAgEAq/D6chAcLq3YbqqCEE00uvK2WCGf
// SIG // Qhsqa+laUKq4BjgaBEm6f8MMHt03a8YS2AvwOMKZBrDI
// SIG // OdUBFDFC04kNeWSHfpRgJGyvnkmc6Whe0t+bU7IKLMOv
// SIG // 2akrrnoJr9eWWcpgGgXpZnboMlImEi/nqwhQz7NEt13Y
// SIG // xC4Ddato88tt8zpcoRb0RrrgOGSsbmQ1eKagYw8t00CT
// SIG // +OPeBw3VXHmlSSnnDb6gE3e+lD3v++MrWhAfTVYoonpy
// SIG // 4BI6t0le2O3tQ5GD2Xuye4Yb2T6xjF3oiU+EGvKhL1nk
// SIG // kDstrjNYxbc+/jLTswM9sbKvkjh+0p2ALPVOVpEhNSXD
// SIG // OW5kf1O6nA+tGSOEy/S6A4aN91/w0FK/jJSHvMAhdCVf
// SIG // GCi2zCcoOCWYOUo2z3yxkq4cI6epZuxhH2rhKEmdX4ji
// SIG // JV3TIUs+UsS1Vz8kA/DRelsv1SPjcF0PUUZ3s/gA4bys
// SIG // AoJf28AVs70b1FVL5zmhD+kjSbwYuER8ReTBw3J64HLn
// SIG // JN+/RpnF78IcV9uDjexNSTCnq47f7Fufr/zdsGbiwZeB
// SIG // e+3W7UvnSSmnEyimp31ngOaKYnhfsi+E11ecXL93KCjx
// SIG // 7W3DKI8sj0A3T8HhhUSJxAlMxdSlQy90lfdu+HggWCwT
// SIG // XWCVmj5PM4TasIgX3p5O9JawvEagbJjS4NaIjAsCAwEA
// SIG // AaOCAe0wggHpMBAGCSsGAQQBgjcVAQQDAgEAMB0GA1Ud
// SIG // DgQWBBRIbmTlUAXTgqoXNzcitW2oynUClTAZBgkrBgEE
// SIG // AYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8EBAMCAYYw
// SIG // DwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBRyLToC
// SIG // MZBDuRQFTuHqp8cx0SOJNDBaBgNVHR8EUzBRME+gTaBL
// SIG // hklodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2Ny
// SIG // bC9wcm9kdWN0cy9NaWNSb29DZXJBdXQyMDExXzIwMTFf
// SIG // MDNfMjIuY3JsMF4GCCsGAQUFBwEBBFIwUDBOBggrBgEF
// SIG // BQcwAoZCaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
// SIG // aS9jZXJ0cy9NaWNSb29DZXJBdXQyMDExXzIwMTFfMDNf
// SIG // MjIuY3J0MIGfBgNVHSAEgZcwgZQwgZEGCSsGAQQBgjcu
// SIG // AzCBgzA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9kb2NzL3ByaW1hcnljcHMu
// SIG // aHRtMEAGCCsGAQUFBwICMDQeMiAdAEwAZQBnAGEAbABf
// SIG // AHAAbwBsAGkAYwB5AF8AcwB0AGEAdABlAG0AZQBuAHQA
// SIG // LiAdMA0GCSqGSIb3DQEBCwUAA4ICAQBn8oalmOBUeRou
// SIG // 09h0ZyKbC5YR4WOSmUKWfdJ5DJDBZV8uLD74w3LRbYP+
// SIG // vj/oCso7v0epo/Np22O/IjWll11lhJB9i0ZQVdgMknzS
// SIG // Gksc8zxCi1LQsP1r4z4HLimb5j0bpdS1HXeUOeLpZMlE
// SIG // PXh6I/MTfaaQdION9MsmAkYqwooQu6SpBQyb7Wj6aC6V
// SIG // oCo/KmtYSWMfCWluWpiW5IP0wI/zRive/DvQvTXvbiWu
// SIG // 5a8n7dDd8w6vmSiXmE0OPQvyCInWH8MyGOLwxS3OW560
// SIG // STkKxgrCxq2u5bLZ2xWIUUVYODJxJxp/sfQn+N4sOiBp
// SIG // mLJZiWhub6e3dMNABQamASooPoI/E01mC8CzTfXhj38c
// SIG // bxV9Rad25UAqZaPDXVJihsMdYzaXht/a8/jyFqGaJ+HN
// SIG // pZfQ7l1jQeNbB5yHPgZ3BtEGsXUfFL5hYbXw3MYbBL7f
// SIG // QccOKO7eZS/sl/ahXJbYANahRr1Z85elCUtIEJmAH9AA
// SIG // KcWxm6U/RXceNcbSoqKfenoi+kiVH6v7RyOA9Z74v2u3
// SIG // S5fi63V4GuzqN5l5GEv/1rMjaHXmr/r8i+sLgOppO6/8
// SIG // MO0ETI7f33VtY5E90Z1WTk+/gFcioXgRMiF670EKsT/7
// SIG // qMykXcGhiJtXcVZOSEXAQsmbdlsKgEhr/Xmfwb1tbWrJ
// SIG // UnMTDXpQzTGCGf8wghn7AgEBMIGVMH4xCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xKDAmBgNVBAMTH01pY3Jvc29mdCBDb2Rl
// SIG // IFNpZ25pbmcgUENBIDIwMTECEzMAAAKNfkfDgn4FGioA
// SIG // AAAAAo0wDQYJYIZIAWUDBAIBBQCgga4wGQYJKoZIhvcN
// SIG // AQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEO
// SIG // MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIHfW
// SIG // bE4S1sbeKqwfhmiFKPjK1+TnhjBKB3WSju1fL/rzMEIG
// SIG // CisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8AcwBv
// SIG // AGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20w
// SIG // DQYJKoZIhvcNAQEBBQAEggGAt+5UcacFNLQ3zqEI5YP/
// SIG // s+l80n6Qvv2X/4KQejVc1TQHeW7ntOF1bnT7SUgLU6mq
// SIG // HFzZETPHL8KOmW//+S7LYuxBc3ITfO2c0WRDXuHot+fD
// SIG // fGM1HOnU3CdqNqtQtI6VZsOCGFo8Bvb6JNMlR0cQH3Hi
// SIG // 5UUVyqUmyx8L7A1u5yDF6RxrodJf6Hlky11e99+hqG4x
// SIG // t3v9ZEu4/TaNO2G+LXVdMiwx4t0vdIGW6daSOv8ojatV
// SIG // P0ryk0Gj1arKIJdlGFYbDZ49NBPCF+m3+UK7ne6Lwi88
// SIG // 62cZzOXJ/lZaFMS0RztcqXNNhesyN2GVRqdfuRsedXG5
// SIG // srhQaAQ/mUIl8Y1oaV2b9EThNPwRYsv4jvtvgDaTDNYP
// SIG // /YsZh8w3sfErC93Bn6KJG3BgqcFp37mSTvNrA0TBG2N0
// SIG // 3UmIh6xiO2171JiKdSdHFN5VwmasdnaNi9nu5BSjff1p
// SIG // gOqSQ1vZBGq2txjyeHdCidQ3ArY0QgnjxkcykrpZFXqh
// SIG // jqguhTM3oYIXCTCCFwUGCisGAQQBgjcDAwExghb1MIIW
// SIG // 8QYJKoZIhvcNAQcCoIIW4jCCFt4CAQMxDzANBglghkgB
// SIG // ZQMEAgEFADCCAVUGCyqGSIb3DQEJEAEEoIIBRASCAUAw
// SIG // ggE8AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIB
// SIG // BQAEIMZsjuAp4D5f+O2p+abx/3WXCDdLNWG/ND4GugLk
// SIG // w5qqAgZihMmFDwMYEzIwMjIwNTI4MDAzMjM2Ljk4NVow
// SIG // BIACAfSggdSkgdEwgc4xCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // KTAnBgNVBAsTIE1pY3Jvc29mdCBPcGVyYXRpb25zIFB1
// SIG // ZXJ0byBSaWNvMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVT
// SIG // TjpGN0E2LUUyNTEtMTUwQTElMCMGA1UEAxMcTWljcm9z
// SIG // b2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEVwwggcQMIIE
// SIG // +KADAgECAhMzAAABpQDeCMRAB3FOAAEAAAGlMA0GCSqG
// SIG // SIb3DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwMB4XDTIyMDMwMjE4NTExOVoXDTIzMDUxMTE4NTEx
// SIG // OVowgc4xCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKTAnBgNVBAsT
// SIG // IE1pY3Jvc29mdCBPcGVyYXRpb25zIFB1ZXJ0byBSaWNv
// SIG // MSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjpGN0E2LUUy
// SIG // NTEtMTUwQTElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQAD
// SIG // ggIPADCCAgoCggIBALqxhuggaki8wuoOMMd7rsEQnmAh
// SIG // tV8iU1Y0itsHq30TdCXJDmvZjaZ8yvOHYFVhTyD1b5JG
// SIG // JtwZjWz1fglCqsx5qBxP1Wx1CZnsQ1tiRsRWQc12VkET
// SIG // mkY8x46MgHsGyAmhPPpsgRnklGai7HqQFB31x/Qjkx7r
// SIG // bAlr6PblB4tOmaR1nKxl4VIgstDwfneKaoEEw4iN/xTd
// SIG // ztZjwyGiY5hNp6beetkcizgJFO3/yRHYh0gtk+bREhrm
// SIG // Igbarrrgbz7MsnA7tlKvGcO9iHc6+2symrAVy3CzQ4IM
// SIG // NPFcTTx8wTZ+kpv6lFs1eG8xlfsu2NDWKshrMlKH2JpY
// SIG // zWAW1fCOD5irXsE4LOvixZQvbneQE6+iGfIQwabj+fRd
// SIG // ouAU2AiE+iaNsIDapdKab8WLxz6VPRbEL+M6MFkcsoiu
// SIG // KHHoshCp7JhmZ9iM0yrEx2XebOha/XQ342KsRGs2h02g
// SIG // pX6wByyT8eD3MJVIxSRm4MLIilvWcpd9N3rooawbLU6g
// SIG // dk7goKWS69+w2jtouXCEYt6IPfZq8ldi0L/CwYbtv7mb
// SIG // HmIZ9Oc0JEJc6b9gcVDfoPiemMKcz15BLepyx7npQ2Mi
// SIG // DKIscOqKhXuZI+PZerNOHhi/vsy2/Fj9lB6kJrMYSfV0
// SIG // F2frvBSBXMB7xjv8pgqX5QXUe8nTxb4UfJ0cDAvBAgMB
// SIG // AAGjggE2MIIBMjAdBgNVHQ4EFgQUX6aPAwCXrq6tcO77
// SIG // 3FkXS2ipGt8wHwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXS
// SIG // ZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
// SIG // cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAo
// SIG // MSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcw
// SIG // AoZQaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9w
// SIG // cy9jZXJ0cy9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIw
// SIG // UENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAT
// SIG // BgNVHSUEDDAKBggrBgEFBQcDCDANBgkqhkiG9w0BAQsF
// SIG // AAOCAgEAlpsLF+UwMKKER2p0WJno4G6GGGnfg3qjDdaH
// SIG // c5uvXYtG6KmHrqAf/YqHkmNotSr6ZEEnlGCJYR7W3uJ+
// SIG // 5bpvj03wFqGefvQsKIR2+q6TrzozvP4NsodWTT5SVp/C
// SIG // 6TEDGuLC9mOQKA4tyL40HTW7txb0cAdfgnyHFoI/BsZo
// SIG // /FaXezQ8hO4xUjhDpyNNeJ6WYvX5NC+Hv9nmTyzjqyEg
// SIG // /L2cXAOmxEWvfPAQ1lfxvrtUwG75jGeUaewkhwtzanCn
// SIG // P3l6YjwJFKB6n7/TXtrfik1xY1kgev1JwQ5aUdPxwSdD
// SIG // mGE4XTN2s6pPOi8IO199Of6AEvh41eDxRz+11VUcpuGn
// SIG // 7tJUeSTUSHsvzQ8ECOj5w77Mv55/F8hWu07egnG8SrWj
// SIG // 5+TFxNPCpx/AFNvzz+odTRTZd4LWuomcMHUmLFiUGOAd
// SIG // etF6SofHG5EcFn0DTD1apBZzCP8xsGQcZgwVqo7ov23/
// SIG // uIJlMCLAyTYZV9ITCP09ciUJbKBVCQNrGEnQ/XLFO9my
// SIG // syyDRrvHhU5uGPdXz4Jt2/ZN7JQYRuVNSuCpNwoK0Jr1
// SIG // s6ciDvHEeLyiczxoIe9GH3SyfbHx6v/phI+iE3DWo1TC
// SIG // K75EL6pt6k5i36/kn2uSVXdTH44ZVkh3/ihV3vEws78u
// SIG // GlvsiMcrKBgpo3HdcjDHiHoWsUf4GIwwggdxMIIFWaAD
// SIG // AgECAhMzAAAAFcXna54Cm0mZAAAAAAAVMA0GCSqGSIb3
// SIG // DQEBCwUAMIGIMQswCQYDVQQGEwJVUzETMBEGA1UECBMK
// SIG // V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
// SIG // A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMTIwMAYD
// SIG // VQQDEylNaWNyb3NvZnQgUm9vdCBDZXJ0aWZpY2F0ZSBB
// SIG // dXRob3JpdHkgMjAxMDAeFw0yMTA5MzAxODIyMjVaFw0z
// SIG // MDA5MzAxODMyMjVaMHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIIC
// SIG // CgKCAgEA5OGmTOe0ciELeaLL1yR5vQ7VgtP97pwHB9Kp
// SIG // bE51yMo1V/YBf2xK4OK9uT4XYDP/XE/HZveVU3Fa4n5K
// SIG // Wv64NmeFRiMMtY0Tz3cywBAY6GB9alKDRLemjkZrBxTz
// SIG // xXb1hlDcwUTIcVxRMTegCjhuje3XD9gmU3w5YQJ6xKr9
// SIG // cmmvHaus9ja+NSZk2pg7uhp7M62AW36MEBydUv626GIl
// SIG // 3GoPz130/o5Tz9bshVZN7928jaTjkY+yOSxRnOlwaQ3K
// SIG // Ni1wjjHINSi947SHJMPgyY9+tVSP3PoFVZhtaDuaRr3t
// SIG // pK56KTesy+uDRedGbsoy1cCGMFxPLOJiss254o2I5Jas
// SIG // AUq7vnGpF1tnYN74kpEeHT39IM9zfUGaRnXNxF803RKJ
// SIG // 1v2lIH1+/NmeRd+2ci/bfV+AutuqfjbsNkz2K26oElHo
// SIG // vwUDo9Fzpk03dJQcNIIP8BDyt0cY7afomXw/TNuvXsLz
// SIG // 1dhzPUNOwTM5TI4CvEJoLhDqhFFG4tG9ahhaYQFzymei
// SIG // XtcodgLiMxhy16cg8ML6EgrXY28MyTZki1ugpoMhXV8w
// SIG // dJGUlNi5UPkLiWHzNgY1GIRH29wb0f2y1BzFa/ZcUlFd
// SIG // Etsluq9QBXpsxREdcu+N+VLEhReTwDwV2xo3xwgVGD94
// SIG // q0W29R6HXtqPnhZyacaue7e3PmriLq0CAwEAAaOCAd0w
// SIG // ggHZMBIGCSsGAQQBgjcVAQQFAgMBAAEwIwYJKwYBBAGC
// SIG // NxUCBBYEFCqnUv5kxJq+gpE8RjUpzxD/LwTuMB0GA1Ud
// SIG // DgQWBBSfpxVdAF5iXYP05dJlpxtTNRnpcjBcBgNVHSAE
// SIG // VTBTMFEGDCsGAQQBgjdMg30BATBBMD8GCCsGAQUFBwIB
// SIG // FjNodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L0RvY3MvUmVwb3NpdG9yeS5odG0wEwYDVR0lBAwwCgYI
// SIG // KwYBBQUHAwgwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBD
// SIG // AEEwCwYDVR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8w
// SIG // HwYDVR0jBBgwFoAU1fZWy4/oolxiaNE9lJBb186aGMQw
// SIG // VgYDVR0fBE8wTTBLoEmgR4ZFaHR0cDovL2NybC5taWNy
// SIG // b3NvZnQuY29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9v
// SIG // Q2VyQXV0XzIwMTAtMDYtMjMuY3JsMFoGCCsGAQUFBwEB
// SIG // BE4wTDBKBggrBgEFBQcwAoY+aHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraS9jZXJ0cy9NaWNSb29DZXJBdXRf
// SIG // MjAxMC0wNi0yMy5jcnQwDQYJKoZIhvcNAQELBQADggIB
// SIG // AJ1VffwqreEsH2cBMSRb4Z5yS/ypb+pcFLY+TkdkeLEG
// SIG // k5c9MTO1OdfCcTY/2mRsfNB1OW27DzHkwo/7bNGhlBgi
// SIG // 7ulmZzpTTd2YurYeeNg2LpypglYAA7AFvonoaeC6Ce57
// SIG // 32pvvinLbtg/SHUB2RjebYIM9W0jVOR4U3UkV7ndn/OO
// SIG // PcbzaN9l9qRWqveVtihVJ9AkvUCgvxm2EhIRXT0n4ECW
// SIG // OKz3+SmJw7wXsFSFQrP8DJ6LGYnn8AtqgcKBGUIZUnWK
// SIG // NsIdw2FzLixre24/LAl4FOmRsqlb30mjdAy87JGA0j3m
// SIG // Sj5mO0+7hvoyGtmW9I/2kQH2zsZ0/fZMcm8Qq3UwxTSw
// SIG // ethQ/gpY3UA8x1RtnWN0SCyxTkctwRQEcb9k+SS+c23K
// SIG // jgm9swFXSVRk2XPXfx5bRAGOWhmRaw2fpCjcZxkoJLo4
// SIG // S5pu+yFUa2pFEUep8beuyOiJXk+d0tBMdrVXVAmxaQFE
// SIG // fnyhYWxz/gq77EFmPWn9y8FBSX5+k77L+DvktxW/tM4+
// SIG // pTFRhLy/AsGConsXHRWJjXD+57XQKBqJC4822rpM+Zv/
// SIG // Cuk0+CQ1ZyvgDbjmjJnW4SLq8CdCPSWU5nR0W2rRnj7t
// SIG // fqAxM328y+l7vzhwRNGQ8cirOoo6CGJ/2XBjU02N7oJt
// SIG // pQUQwXEGahC0HVUzWLOhcGbyoYICzzCCAjgCAQEwgfyh
// SIG // gdSkgdEwgc4xCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
// SIG // YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
// SIG // VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKTAnBgNV
// SIG // BAsTIE1pY3Jvc29mdCBPcGVyYXRpb25zIFB1ZXJ0byBS
// SIG // aWNvMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjpGN0E2
// SIG // LUUyNTEtMTUwQTElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
// SIG // bWUtU3RhbXAgU2VydmljZaIjCgEBMAcGBSsOAwIaAxUA
// SIG // s8lw20WzmxDKiN1Lhh7mZWXutKiggYMwgYCkfjB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDANBgkqhkiG9w0B
// SIG // AQUFAAIFAOY7zfIwIhgPMjAyMjA1MjgwMjIzNDZaGA8y
// SIG // MDIyMDUyOTAyMjM0NlowdDA6BgorBgEEAYRZCgQBMSww
// SIG // KjAKAgUA5jvN8gIBADAHAgEAAgIKzDAHAgEAAgIR0TAK
// SIG // AgUA5j0fcgIBADA2BgorBgEEAYRZCgQCMSgwJjAMBgor
// SIG // BgEEAYRZCgMCoAowCAIBAAIDB6EgoQowCAIBAAIDAYag
// SIG // MA0GCSqGSIb3DQEBBQUAA4GBAG+OLTdh2ZixH59T4VRn
// SIG // SA6P0JhQqUdhztiOB/rd2DLTAcvLD2pBkhHzCK1+WFp7
// SIG // RLnrsF78HvR6Nz9MHCk0OpAqYsLEBNR/SfwXvfSdRaaG
// SIG // 6xbLjIqLiShL0UgsaCKqTTh7c+8d6/hO2fTN2vnB9V0r
// SIG // WK8iqXfos+P1hCUyndPcMYIEDTCCBAkCAQEwgZMwfDEL
// SIG // MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
// SIG // EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
// SIG // c29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9z
// SIG // b2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAGlAN4I
// SIG // xEAHcU4AAQAAAaUwDQYJYIZIAWUDBAIBBQCgggFKMBoG
// SIG // CSqGSIb3DQEJAzENBgsqhkiG9w0BCRABBDAvBgkqhkiG
// SIG // 9w0BCQQxIgQgFKKejowFYPf3/Qk1FE9fD3NHOQL5xRDP
// SIG // gQzjGL7VnSMwgfoGCyqGSIb3DQEJEAIvMYHqMIHnMIHk
// SIG // MIG9BCC4CjhxfmYEsaCt2AU83Khh+6JHlyk3B70vfMHM
// SIG // lBLcXDCBmDCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwAhMzAAABpQDeCMRAB3FOAAEAAAGlMCIEIIHQ
// SIG // D66alzuZ7U+rYPg6UB9CQBp6Vz+s9djYhZizRI/lMA0G
// SIG // CSqGSIb3DQEBCwUABIICAAce+C/lgErkdlwIZjwF8+UC
// SIG // bq19Chn7f02cqfwrNllEVBd6utFc+UAuL912Kwi518HX
// SIG // 0Um4/vW6Vk93jX1/z3Osgenygtm90aoYpfyGFEHidZee
// SIG // uRjwcsVbI2jULMUQ7vwmCYkvvZMxnASH5iNVMz6Y/CR9
// SIG // Nx52ETmzcrI/hgH2frD2IvlSAV6ZSxuSm1Bf42rAtTrp
// SIG // LGstwkYlN0B1He9FBgUyzB5959XL2AGlEPXKh1F1c7rv
// SIG // ndpeueoBQomwH1h5KZHnESPg6qPHDzhQJA7JMeA2C9x5
// SIG // s4aaYLCegcrVaDZSB6TNJV+m0EVTxkl9CP9elpHD77XE
// SIG // qZNaPClSWFNakxJnw1lM4Qwt4zRQbBPYZcgLZ35VwSXD
// SIG // OM8TPbRujpEpQ5U3WNywNTusISp2RU10eWL6Em2v7Rre
// SIG // P2+EpGe40tNg1nrezrQySIhq+tHFvc7ZBf+0CP7Xkr+6
// SIG // zW3Ws3BKBJga1AQj1wzGgcTGNMeZG53Vrsh4ANU1sznc
// SIG // BfQfpCMn9wblE+X9GTrFq6Fg7Wx7ZG63gTEbFwBtvSSv
// SIG // maFHsEx2EAPjtBV25hsYJtUELkug25i7T6lKGCMAzuZJ
// SIG // iEkn8QZtZdw7JTtPNmz+R0NOa/uFPw0Me0XB+je6loBr
// SIG // ViyofSYtATTXQ49D+FKMEGX628FrMbTLeggKbef/z162
// SIG // End signature block
