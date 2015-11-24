/**
 * @author mrdoob / http://www.mrdoob.com
 */

function simulationCommon() {
    return [
      'uniform float u_timer;',
      'uniform sampler2D u_texPos;',
      'uniform sampler2D u_texPrevPos;',
      'float DAMPING = -0.0125;',
      'vec2 getNeighbor(int n, out float ks, out float kd)',
  '{',
  //structural springs (adjacent neighbors)
  '	if (n < 4){ ks = 50.75; kd = -0.25; }',	//ksStr, kdStr
  '	if (n == 0)	return vec2(1.0, 0.0);',
  '	if (n == 1)	return vec2(0.0, -1.0);',
  '	if (n == 2)	return vec2(-1.0, 0.0);',
  '	if (n == 3)	return vec2(0.0, 1.0);',
//shear springs (diagonal neighbors)
'if (n<8) { ks = 50.75; kd = -0.25; } ',//ksShr,kdShr
'if (n == 4) return vec2(1.0, -1.0);',
'if (n == 5) return vec2(-1.0, -1.0);',
'if (n == 6) return vec2(-1.0, 1.0);',
'if (n == 7) return vec2(1.0, 1.0);',
//bend spring (adjacent neighbors 1 node away)
'if (n<12) { ks =50.75; kd = -0.25; }', //ksBnd,kdBnd
'if (n == 8)	return vec2(2.0, 0.0);',
'if (n == 9) return vec2(0.0, -2.0);',
'if (n == 10) return vec2(-2.0, 0.0);',
'if (n == 11) return vec2(0.0, 2.0);',
  'return vec2(0.0,0.0);',
  '}',

      'vec4 runSimulation(vec4 pos,float v_id) {',
      'float mass = 1.0;',
      'float xid = float( int(v_id)/100);',
      'float yid = v_id - 100.0*xid;',
      'vec2 coord;',
      'coord = vec2(yid,99.0-xid)*(1.0/100.0);',
      'float timestep = 1.0/600.0;//u_timer/100.0;',
      ' vec4 texPos = texture2D(u_texPos,coord);',
      ' vec4 texPrevPos = texture2D(u_texPrevPos,coord);',
      'vec3 F = vec3(0.0);',
      'F.y = -2.8*mass;',//gravity  well later...
      ' vec3 vel = (texPos.xyz-texPrevPos.xyz)/timestep;',
      'F+=DAMPING*vel;',



  'float ks, kd;',

  'for (int k = 0; k < 12; k++)',
  '{',
  '	vec2 nCoord = getNeighbor(k, ks, kd);',

  '	float inv_cloth_size = 1.0 / (100.0);//size of a single patch in world space',
  '	float rest_length = length(nCoord*inv_cloth_size);',

  '	float nxid = xid + nCoord.x;',
  '	float nyid = yid + nCoord.y;',
  '	if (nxid < 0.0 || nxid>99.0 || nyid<0.0 || nyid>99.0) continue;',

  '	nCoord = vec2(nyid,99.0-nxid) / 100.0;',
  '	vec3 posNP = texture2D(u_texPos, nCoord).xyz;',
  '	vec3 prevNP = texture2D(u_texPrevPos, nCoord).xyz;',

  '	vec3 v2 = (posNP - prevNP) / timestep;',
  '	vec3 deltaP = pos.xyz - posNP;',
  '	vec3 deltaV = vel - v2;',
  '	float dist = length(deltaP);',

  '	float   leftTerm = -ks * (dist - rest_length);',
  '	float  rightTerm = kd * (dot(deltaV, deltaP) / dist);',
  '	vec3 springForce = (leftTerm + rightTerm)* normalize(deltaP);',
  '	F += springForce;',
  '};',



      'vec3 acc = F/mass;', // acc = F/m

      'vel = vel+ acc*timestep;',//v = v0+a*t
      'if(((xid>=95.0)||(xid<=5.0))&&(yid<=5.0)); else pos.xyz+=vel;//pos.x -= 0.01;',
      // pos = 2*pos-prevpos+acc*dt*dt
      //else pos.xyz = 2.0*pos.xyz-texPrevPos.xyz+acc*timestep*timestep;//
      //'if(texPos.xyz==pos.xyz); else pos.x -= 0.01;',
      '  return pos;',
      '}',
    ].join('\n');
}
GPGPU2.SimulationShader2 = function (renderer) {
  var gl = renderer.context;

  var attributes = {
      a_position: 0,
      a_prevpos: 1,
  };

  function createProgram () {

      //Sadly, it seems that WebGL doesn't support gl_VertexID.... T^T
      //http://max-limper.de/tech/batchedrendering.html

      //well....uniform block..
      //https://www.opengl.org/wiki/Interface_Block_(GLSL)
    var vertexShader = gl.createShader( gl.VERTEX_SHADER );
    var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );

    gl.shaderSource(vertexShader, [
       // '#version 140',
       // '#extension GL_ARB_explicit_attrib_location : require',
       // '#extension GL_ARB_explicit_uniform_location : require',
        'precision ' + renderer.getPrecision() + ' float;',
      'attribute vec4 a_position;',
      'attribute vec4 a_prevpos;',

      'varying vec4 v_prevpos;',
      simulationCommon(),

      'void main() {',
      '  vec4 pos = a_position;',
      'float vid = pos.w;',
      '  v_prevpos = pos;',
      ' pos = runSimulation(pos,vid);',
     '  // Write new position out',
     '  gl_Position =vec4(pos.xyz,vid);//vec4(vec3(pos.w)*0.02,pos.w); ',
      '}'
    ].join('\n'));

    gl.shaderSource(fragmentShader, [
      'precision ' + renderer.getPrecision() + ' float;',
      'varying vec4 v_prevpos;',
      'void main() {',
        'gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);',
      '}'
    ].join('\n'));

    gl.compileShader( vertexShader );
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("Shader failed to compile", gl.getShaderInfoLog( vertexShader ));
      return null;
    }

    gl.compileShader( fragmentShader );
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("Shader failed to compile", gl.getShaderInfoLog( fragmentShader ));
      return null;
    }

    var program = gl.createProgram();

    gl.attachShader( program, vertexShader );
    gl.attachShader( program, fragmentShader );

    gl.deleteShader( vertexShader );
    gl.deleteShader( fragmentShader );

    for (var i in attributes) {
      gl.bindAttribLocation( program, attributes[i], i );
    }
    var maxSepTrans = gl.getParameter(gl.MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS);

    gl.transformFeedbackVaryings(program, ["gl_Position"], gl.SEPARATE_ATTRIBS);

    gl.linkProgram( program );

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Shader program failed to link", gl.getProgramInfoLog( program ));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  var program = createProgram();

  if (!program) {
    return null;
  }

  var uniforms = {};
  var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (var i = 0; i < count; i++) {
      uniform = gl.getActiveUniform(program, i);
      name = uniform.name.replace("[0]", "");
      uniforms[name] = gl.getUniformLocation(program, name);
  }

  var timerValue = 0;

  return {
    program: program,

    attributes: attributes,

    bind: function (tempData,prevData) {
        //!!! VBO -> Texture ?????
        //http://stackoverflow.com/questions/17262574/packing-vertex-data-into-a-webgl-texture
        //TODO: don't need to re-create texture every frame.....put those into init
        gl.useProgram(program);
        
        var tempTexture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, tempTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 100, 100, 0, gl.RGBA, gl.FLOAT, new Float32Array(tempData));

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tempTexture);
        gl.uniform1i(uniforms.u_texPos, 0);

        var tempPrevTexture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, tempPrevTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 100, 100, 0, gl.RGBA, gl.FLOAT, new Float32Array(prevData));

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tempPrevTexture);
        gl.uniform1i(uniforms.u_texPrevPos, 1);

        gl.uniform1f(uniforms.u_timer, timer);

    },

    setTimer: function ( timer ) {
      timerValue = timer;
    },


  }

};