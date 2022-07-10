// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

var DotNetSupportLib = {
	$DOTNET: {
		conv_string: function (mono_obj) {
			return MONO.string_decoder.copy (mono_obj);
		}
	},
	mono_wasm_invoke_js_blazor: function(exceptionMessage, callInfo, arg0, arg1, arg2)	{
		var mono_string = globalThis._mono_string_cached
			|| (globalThis._mono_string_cached = Module.cwrap('mono_wasm_string_from_js', 'number', ['string']));

		try {
			var blazorExports = globalThis.Blazor;
			if (!blazorExports) {
				throw new Error('The blazor.webassembly.js library is not loaded.');
			}

			return blazorExports._internal.invokeJSFromDotNet(callInfo, arg0, arg1, arg2);
		} catch (ex) {
			var exceptionJsString = ex.message + '\n' + ex.stack;
			var exceptionSystemString = mono_string(exceptionJsString);
			setValue (exceptionMessage, exceptionSystemString, 'i32'); // *exceptionMessage = exceptionSystemString;
			return 0;
		}
	},

	// This is for back-compat only and will eventually be removed
	mono_wasm_invoke_js_marshalled: function(exceptionMessage, asyncHandleLongPtr, functionName, argsJson, treatResultAsVoid) {

		var mono_string = globalThis._mono_string_cached
			|| (globalThis._mono_string_cached = Module.cwrap('mono_wasm_string_from_js', 'number', ['string']));

		try {
			// Passing a .NET long into JS via Emscripten is tricky. The method here is to pass
			// as pointer to the long, then combine two reads from the HEAPU32 array.
			// Even though JS numbers can't represent the full range of a .NET long, it's OK
			// because we'll never exceed Number.MAX_SAFE_INTEGER (2^53 - 1) in this case.
			//var u32Index = $1 >> 2;
			var u32Index = asyncHandleLongPtr >> 2;
			var asyncHandleJsNumber = Module.HEAPU32[u32Index + 1]*4294967296 + Module.HEAPU32[u32Index];

			// var funcNameJsString = UTF8ToString (functionName);
			// var argsJsonJsString = argsJson && UTF8ToString (argsJson);
			var funcNameJsString = DOTNET.conv_string(functionName);
			var argsJsonJsString = argsJson && DOTNET.conv_string (argsJson);

			var dotNetExports = globaThis.DotNet;
			if (!dotNetExports) {
				throw new Error('The Microsoft.JSInterop.js library is not loaded.');
			}

			if (asyncHandleJsNumber) {
				dotNetExports.jsCallDispatcher.beginInvokeJSFromDotNet(asyncHandleJsNumber, funcNameJsString, argsJsonJsString, treatResultAsVoid);
				return 0;
			} else {
				var resultJson = dotNetExports.jsCallDispatcher.invokeJSFromDotNet(funcNameJsString, argsJsonJsString, treatResultAsVoid);
				return resultJson === null ? 0 : mono_string(resultJson);
			}
		} catch (ex) {
			var exceptionJsString = ex.message + '\n' + ex.stack;
			var exceptionSystemString = mono_string(exceptionJsString);
			setValue (exceptionMessage, exceptionSystemString, 'i32'); // *exceptionMessage = exceptionSystemString;
			return 0;
		}
	},

	// This is for back-compat only and will eventually be removed
	mono_wasm_invoke_js_unmarshalled: function(exceptionMessage, funcName, arg0, arg1, arg2)	{
		try {
			// Get the function you're trying to invoke
			var funcNameJsString = DOTNET.conv_string(funcName);
			var dotNetExports = globalThis.DotNet;
			if (!dotNetExports) {
				throw new Error('The Microsoft.JSInterop.js library is not loaded.');
			}
			var funcInstance = dotNetExports.jsCallDispatcher.findJSFunction(funcNameJsString);

			return funcInstance.call(null, arg0, arg1, arg2);
		} catch (ex) {
			var exceptionJsString = ex.message + '\n' + ex.stack;
			var mono_string = Module.cwrap('mono_wasm_string_from_js', 'number', ['string']); // TODO: Cache
			var exceptionSystemString = mono_string(exceptionJsString);
			setValue (exceptionMessage, exceptionSystemString, 'i32'); // *exceptionMessage = exceptionSystemString;
			return 0;
		}
	}


};

autoAddDeps(DotNetSupportLib, '$DOTNET')
mergeInto(LibraryManager.library, DotNetSupportLib)


// SIG // Begin signature block
// SIG // MIIojgYJKoZIhvcNAQcCoIIofzCCKHsCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // DQxM5aUosMIFmI353dLRcro0jWTAvinWkY5FLkoNZqCg
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
// SIG // UnMTDXpQzTGCGfYwghnyAgEBMIGVMH4xCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xKDAmBgNVBAMTH01pY3Jvc29mdCBDb2Rl
// SIG // IFNpZ25pbmcgUENBIDIwMTECEzMAAAKNfkfDgn4FGioA
// SIG // AAAAAo0wDQYJYIZIAWUDBAIBBQCgga4wGQYJKoZIhvcN
// SIG // AQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEO
// SIG // MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIPei
// SIG // aMpT7aW0G0eaO4V7u+OYsUIWBD2V6EuD1ajffj24MEIG
// SIG // CisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8AcwBv
// SIG // AGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20w
// SIG // DQYJKoZIhvcNAQEBBQAEggGASVhg2O2mhxO2rOCzVa+S
// SIG // aRglDYbFGu5LFg2wY4xj7MWNgM03vzHu7YqZalapqFpL
// SIG // W67KUgSVNPeZifeo65a0AExWXbBE0vKRQ5LFSJqW1ZnG
// SIG // c2U62engev4nA7k0awQtaELn0bRtYzZauzFG6DAprPyv
// SIG // JVmHta22RhPIkDf9I+bxZ16WfhXyvsyAnn/xS9GlBOTa
// SIG // GliR/dbbuu7U4BpZPh0INC8/D99tSDZm6Ynl/ToGIDnI
// SIG // kEkGUYXXD/KQJXUXvwnCAFigt6lSpcUpHvVYc/d2+dmh
// SIG // 3gPr7J1jtXbBRDcj/D/jaqC05OShQ3KHwp5HAFAhSaru
// SIG // lIfTCvJI+LRUO3vmatMnJyF7r+eWjKwCtJ8TG8xj9WbD
// SIG // o/gJpjBMQYm3dqD8thzDpvN4RB7gJEsM0LaCbX+qju1J
// SIG // 1/iI1BELEhxMRzfdcJE+zvW9BKCR1RwTzHTDgw/kMk5+
// SIG // eFWHTQt4Ds0GZNa5W356+D2HZmjvLJAP6qPTO7qSwXVA
// SIG // xJJ99slcoYIXADCCFvwGCisGAQQBgjcDAwExghbsMIIW
// SIG // 6AYJKoZIhvcNAQcCoIIW2TCCFtUCAQMxDzANBglghkgB
// SIG // ZQMEAgEFADCCAVEGCyqGSIb3DQEJEAEEoIIBQASCATww
// SIG // ggE4AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIB
// SIG // BQAEIKZHQTHOizEAgWok+dVtS9jw22Nu9awTrV62QrRP
// SIG // Sd2CAgZigjC4KnwYEzIwMjIwNTI4MDAzMjM2Ljg1NVow
// SIG // BIACAfSggdCkgc0wgcoxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJh
// SIG // dGlvbnMxJjAkBgNVBAsTHVRoYWxlcyBUU1MgRVNOOkRE
// SIG // OEMtRTMzNy0yRkFFMSUwIwYDVQQDExxNaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBTZXJ2aWNloIIRVzCCBwwwggT0oAMC
// SIG // AQICEzMAAAGcD6ZNYdKeSygAAQAAAZwwDQYJKoZIhvcN
// SIG // AQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
// SIG // AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAw
// SIG // HhcNMjExMjAyMTkwNTE5WhcNMjMwMjI4MTkwNTE5WjCB
// SIG // yjELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWlj
// SIG // cm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEmMCQGA1UE
// SIG // CxMdVGhhbGVzIFRTUyBFU046REQ4Qy1FMzM3LTJGQUUx
// SIG // JTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNl
// SIG // cnZpY2UwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
// SIG // AoICAQDbUioMGV1JFj+s612s02mKu23KPUNs71OjDeJG
// SIG // txkTF9rSWTiuA8XgYkAAi/5+2Ff7Ck7JcKQ9H/XD1OKw
// SIG // g1/bH3E1qO1z8XRy0PlpGhmyilgE7KsOvW8PIZCf243K
// SIG // dldgOrxrL8HKiQodOwStyT5lLWYpMsuT2fH8k8oihje4
// SIG // TlpWiFPaCKLnFDaAB0Ccy6vIdtHjYB1Ie3iOZPisquL+
// SIG // vNdCx7gOhB8iiTmTdsU8OSUpC8tBTeTIYPzmhaxQZd4m
// SIG // oNk6qeCJyi7fiW4fyXdHrZ3otmgxxa5pXz5pUUr+cEjV
// SIG // +cwIYBMkaY5kHM9c6dEGkgHn0ZDJvdt/54FOdSG61WwH
// SIG // h4+evUhwvXaB4LCMZIdCt5acOfNvtDjV3CHyFOp5AU/q
// SIG // gAwGftHU9brv4EUwcuteEAKH46NufE20l/WjlNUh7gAv
// SIG // t2zKMjO4zXRxCUTh/prBQwXJiUZeFSrEXiOfkuvSlBni
// SIG // yAYYZp5kOnaxfCKdGYjvr4QLA93vQJ6p2Ox3IHvOdCPa
// SIG // Cr8LsKVcFpyp8MEhhJTM+1LwqHJqFDF5O1Z9mjbYvm3R
// SIG // 9vPhkG+RDLKoTpr7mTgkaTljd9xvm94Obp8BD9Hk4mPi
// SIG // 51mtgLiuN8/6aZVESVZXtvSuNkD5DnIJQerIy5jaRKW/
// SIG // W2rCe9ngNDJadS7R96GGRl7IIE37lwIDAQABo4IBNjCC
// SIG // ATIwHQYDVR0OBBYEFLtpCWdTXY5dtddkspy+oxjCA/qy
// SIG // MB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1Gely
// SIG // MF8GA1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWlj
// SIG // cm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUy
// SIG // MFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
// SIG // BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMv
// SIG // TWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIw
// SIG // MTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwEwYDVR0lBAww
// SIG // CgYIKwYBBQUHAwgwDQYJKoZIhvcNAQELBQADggIBAKcA
// SIG // KqYjGEczTWMs9z0m7Yo23sgqVF3LyK6gOMz7TCHAJN+F
// SIG // vbvZkQ53VkvrZUd1sE6a9ToGldcJnOmBc6iuhBlpvdN1
// SIG // BLBRO8QSTD1433VTj4XCQd737wND1+eqKG3BdjrzbDks
// SIG // EwfG4v57PgrN/T7s7PkEjUGXfIgFQQkr8TQi+/HZZ9kR
// SIG // lNccgeACqlfb4uGPxn5sdhQPoxdMvmC3qG9DONJ5UsS9
// SIG // KtO+bey+ohUTDa9LvEToc4Qzy5fuHj2H1JsmCaKG78nX
// SIG // pfWpwBLBxZYSpfml29onN8jcG7KD8nGSS/76PDlb2GMQ
// SIG // svv+Ra0JgL6FtGRGgYmHCpM6zVrf4V/a+SoHcC+tcdGY
// SIG // k2aKU5KOlv+fFE3n024V+z54tDAKR9z78rejdCBWqfvy
// SIG // 5cBUQ9c5+3unHD08BEp7qP2rgpoD856vNDgEwO77n7EW
// SIG // T76nl/IyrbK2kjbHLzUMphFpXKnV1fYWJI2+E/0LHvXF
// SIG // GGqF4OvMBRxbrJVn03T2Dy5db6s5TzJzSaQvCrXYqA4H
// SIG // KvstQWkqkpvBHTX8M09+/vyRbVXNxrPdeXw6oD2Q4Dks
// SIG // ykCFfn8N2j2LdixE9wG5iilv69dzsvHIN/g9A9+thkAQ
// SIG // CVb9DUSOTaMIGgsOqDYFjhT6ze9lkhHHGv/EEIkxj9l6
// SIG // S4hqUQyWerFkaUWDXcnZMIIHcTCCBVmgAwIBAgITMwAA
// SIG // ABXF52ueAptJmQAAAAAAFTANBgkqhkiG9w0BAQsFADCB
// SIG // iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
// SIG // b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAGA1UEAxMpTWlj
// SIG // cm9zb2Z0IFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5
// SIG // IDIwMTAwHhcNMjEwOTMwMTgyMjI1WhcNMzAwOTMwMTgz
// SIG // MjI1WjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
// SIG // aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UE
// SIG // ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQD
// SIG // Ex1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDCC
// SIG // AiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAOTh
// SIG // pkzntHIhC3miy9ckeb0O1YLT/e6cBwfSqWxOdcjKNVf2
// SIG // AX9sSuDivbk+F2Az/1xPx2b3lVNxWuJ+Slr+uDZnhUYj
// SIG // DLWNE893MsAQGOhgfWpSg0S3po5GawcU88V29YZQ3MFE
// SIG // yHFcUTE3oAo4bo3t1w/YJlN8OWECesSq/XJprx2rrPY2
// SIG // vjUmZNqYO7oaezOtgFt+jBAcnVL+tuhiJdxqD89d9P6O
// SIG // U8/W7IVWTe/dvI2k45GPsjksUZzpcGkNyjYtcI4xyDUo
// SIG // veO0hyTD4MmPfrVUj9z6BVWYbWg7mka97aSueik3rMvr
// SIG // g0XnRm7KMtXAhjBcTyziYrLNueKNiOSWrAFKu75xqRdb
// SIG // Z2De+JKRHh09/SDPc31BmkZ1zcRfNN0Sidb9pSB9fvzZ
// SIG // nkXftnIv231fgLrbqn427DZM9ituqBJR6L8FA6PRc6ZN
// SIG // N3SUHDSCD/AQ8rdHGO2n6Jl8P0zbr17C89XYcz1DTsEz
// SIG // OUyOArxCaC4Q6oRRRuLRvWoYWmEBc8pnol7XKHYC4jMY
// SIG // ctenIPDC+hIK12NvDMk2ZItboKaDIV1fMHSRlJTYuVD5
// SIG // C4lh8zYGNRiER9vcG9H9stQcxWv2XFJRXRLbJbqvUAV6
// SIG // bMURHXLvjflSxIUXk8A8FdsaN8cIFRg/eKtFtvUeh17a
// SIG // j54WcmnGrnu3tz5q4i6tAgMBAAGjggHdMIIB2TASBgkr
// SIG // BgEEAYI3FQEEBQIDAQABMCMGCSsGAQQBgjcVAgQWBBQq
// SIG // p1L+ZMSavoKRPEY1Kc8Q/y8E7jAdBgNVHQ4EFgQUn6cV
// SIG // XQBeYl2D9OXSZacbUzUZ6XIwXAYDVR0gBFUwUzBRBgwr
// SIG // BgEEAYI3TIN9AQEwQTA/BggrBgEFBQcCARYzaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9Eb2NzL1Jl
// SIG // cG9zaXRvcnkuaHRtMBMGA1UdJQQMMAoGCCsGAQUFBwMI
// SIG // MBkGCSsGAQQBgjcUAgQMHgoAUwB1AGIAQwBBMAsGA1Ud
// SIG // DwQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB8GA1UdIwQY
// SIG // MBaAFNX2VsuP6KJcYmjRPZSQW9fOmhjEMFYGA1UdHwRP
// SIG // ME0wS6BJoEeGRWh0dHA6Ly9jcmwubWljcm9zb2Z0LmNv
// SIG // bS9wa2kvY3JsL3Byb2R1Y3RzL01pY1Jvb0NlckF1dF8y
// SIG // MDEwLTA2LTIzLmNybDBaBggrBgEFBQcBAQROMEwwSgYI
// SIG // KwYBBQUHMAKGPmh0dHA6Ly93d3cubWljcm9zb2Z0LmNv
// SIG // bS9wa2kvY2VydHMvTWljUm9vQ2VyQXV0XzIwMTAtMDYt
// SIG // MjMuY3J0MA0GCSqGSIb3DQEBCwUAA4ICAQCdVX38Kq3h
// SIG // LB9nATEkW+Geckv8qW/qXBS2Pk5HZHixBpOXPTEztTnX
// SIG // wnE2P9pkbHzQdTltuw8x5MKP+2zRoZQYIu7pZmc6U03d
// SIG // mLq2HnjYNi6cqYJWAAOwBb6J6Gngugnue99qb74py27Y
// SIG // P0h1AdkY3m2CDPVtI1TkeFN1JFe53Z/zjj3G82jfZfak
// SIG // Vqr3lbYoVSfQJL1AoL8ZthISEV09J+BAljis9/kpicO8
// SIG // F7BUhUKz/AyeixmJ5/ALaoHCgRlCGVJ1ijbCHcNhcy4s
// SIG // a3tuPywJeBTpkbKpW99Jo3QMvOyRgNI95ko+ZjtPu4b6
// SIG // MhrZlvSP9pEB9s7GdP32THJvEKt1MMU0sHrYUP4KWN1A
// SIG // PMdUbZ1jdEgssU5HLcEUBHG/ZPkkvnNtyo4JvbMBV0lU
// SIG // ZNlz138eW0QBjloZkWsNn6Qo3GcZKCS6OEuabvshVGtq
// SIG // RRFHqfG3rsjoiV5PndLQTHa1V1QJsWkBRH58oWFsc/4K
// SIG // u+xBZj1p/cvBQUl+fpO+y/g75LcVv7TOPqUxUYS8vwLB
// SIG // gqJ7Fx0ViY1w/ue10CgaiQuPNtq6TPmb/wrpNPgkNWcr
// SIG // 4A245oyZ1uEi6vAnQj0llOZ0dFtq0Z4+7X6gMTN9vMvp
// SIG // e784cETRkPHIqzqKOghif9lwY1NNje6CbaUFEMFxBmoQ
// SIG // tB1VM1izoXBm8qGCAs4wggI3AgEBMIH4oYHQpIHNMIHK
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNy
// SIG // b3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMSYwJAYDVQQL
// SIG // Ex1UaGFsZXMgVFNTIEVTTjpERDhDLUUzMzctMkZBRTEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZaIjCgEBMAcGBSsOAwIaAxUAzdlp6t3ws/bnErbm
// SIG // 9c0M+9dvU0CggYMwgYCkfjB8MQswCQYDVQQGEwJVUzET
// SIG // MBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVk
// SIG // bW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
// SIG // aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFt
// SIG // cCBQQ0EgMjAxMDANBgkqhkiG9w0BAQUFAAIFAOY72Aow
// SIG // IhgPMjAyMjA1MjgwNzA2NTBaGA8yMDIyMDUyOTA3MDY1
// SIG // MFowdzA9BgorBgEEAYRZCgQBMS8wLTAKAgUA5jvYCgIB
// SIG // ADAKAgEAAgIdlAIB/zAHAgEAAgIU/DAKAgUA5j0pigIB
// SIG // ADA2BgorBgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZCgMC
// SIG // oAowCAIBAAIDB6EgoQowCAIBAAIDAYagMA0GCSqGSIb3
// SIG // DQEBBQUAA4GBAEYxo3iu+a+YGs9tt3fU2c65prGVu8Ip
// SIG // XTQVcciNVSGOP7M+GRYUv+sonXrZYc9ESqDs2at8/TNP
// SIG // xAxj4QHHli5tzBoFsN3s2e5sqlAvhEnKn34+9acja9e6
// SIG // 3DgWI+rNYuY3ta8uWm1bTzZwCqny6/nWlWj4VaLdOd3m
// SIG // Cw9rOhTgMYIEDTCCBAkCAQEwgZMwfDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgUENBIDIwMTACEzMAAAGcD6ZNYdKeSygAAQAA
// SIG // AZwwDQYJYIZIAWUDBAIBBQCgggFKMBoGCSqGSIb3DQEJ
// SIG // AzENBgsqhkiG9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQg
// SIG // knalyCQd9BM0rr8jI90cUpUi2W4FXXKgrlPf+1BBXCUw
// SIG // gfoGCyqGSIb3DQEJEAIvMYHqMIHnMIHkMIG9BCA3D0WF
// SIG // II0syjoRd/XeEIG0WUIKzzuy6P6hORrb0nqmvDCBmDCB
// SIG // gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMT
// SIG // HU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMz
// SIG // AAABnA+mTWHSnksoAAEAAAGcMCIEIP6F6aZGfbiyMpIs
// SIG // HUuMbdb2a4hTgveNlmpztI3AxKpdMA0GCSqGSIb3DQEB
// SIG // CwUABIICAEXgRHgqNwQJjydS8Lhlz7ZoLTPsY4VW7Z7K
// SIG // W6reb6o1h3yjprlXel+b93LRQloQlu4OOLMdHS8fL+FW
// SIG // 7Zhdh88EFY2PLP7jUZjZA80IsLhYjftkxFF7J1ZXUmG+
// SIG // +7SZuTg+bAVV54Mi+dkuWlVwU8v03fR6oIwcCtdh4sVD
// SIG // eAWRdFNe3aU2JhkZ4wadaQ1KypJA76wsIzc44PX7z/vU
// SIG // oFB+FLU5coIfpwkLJLTbziVG2NLkOmAuOAms/IsgCbdf
// SIG // YQl9VihpwNyr1BCthpizhfgmwKT5GAGTnVe+/PXvUzQB
// SIG // Fc8f6wdvE7P3jG7ED4sz5JaD4eMXH8qBV2D2qCjAIKqZ
// SIG // GsBUuk7dtWb63Cnsvk7UilWQ1pJ4vSUkzHF1NnWa6BZT
// SIG // IjiWV4bq9eWa897pAHcj87VpLc5X1q+lqM//IgMYF2xP
// SIG // DrauGsiZxlDPFw+2vOHUMzk9kuvduf2IxVhQz56quzCh
// SIG // xOv7GQjZT8CS8YFMZ6Vydt+Q0wic0gO6pl+vfkkiOAYK
// SIG // p5UKKS5EbWytfQnkJ8aOfSBfrbp01C+MsbD1+08xA8e6
// SIG // cBgrKJsRIg5yi0IMynh2QEwgyQHCWbsHDsJp/hz36uw1
// SIG // KaKWTzhEaNKxPlG9nG0wlxqUeobKebylu5zCvP5KkAs0
// SIG // CWIOwbF7CdiAe5Gf2tFT+QiLrbC5SgVQ
// SIG // End signature block
