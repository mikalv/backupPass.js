/*global $:false, document:false */
// Client side jquery logic for BackupPass
// Copyright Matthew Sperry 2014, distributed under the MIT license
// Turn on jQuery options for JSHint
//


$(document).ready(function() {
  var csrfToken;
  var bad_loginHTML = "Incorrect authorization<br>Wait 2 seconds before retrying";
  $.get('/version', function(data) {
    $("#version").html(data);
  });

  var get_csrf_token = function() {
    $.get('/session', function(data) {
      csrfToken = data.Token;
    });
  };
  get_csrf_token();

  var send_ajax_post = function(url, data, success) {
    $.ajax({
      type: "POST",
      headers: {'X-CSRF-TOKEN': csrfToken},
      url: url,
      contentType: 'application/json',
      data: JSON.stringify(data),
      dataType: "json",
      success: success,
      error: function() {
        $("#verify").show("fast");
        $("#verify").html(bad_loginHTML);
      }
    });
  };



  $("#key").focus();

  var key_submit = function() {
    $("#app").css("overflow", "visible");
    $("#key_div").animate({'left':'-=39em'}, {queue: false, complete: function() {
      $("#key_div").hide();
      var parameters = {key: $("#key").val()};
      var success = function(data, _, xhr) {
        if (data.response === true) {
          $("#pass").focus();
          csrfToken = xhr.getResponseHeader('X-CSRF-TOKEN');
        }
      };
      send_ajax_post('session/auth', parameters, success);
    }
    }, 500);
    $("#pass_div").animate({'left':'-=39em'}, {queue: false}, 500);
  };

  $('#key').keypress(function (e) {
    if (e.which == 13) {
      key_submit();
      return false;    //<---- Add this line
    }
  });

  $('#key_form .form_button').click(function() {
    key_submit();
  });

  var pass_submit = function () {
    $("#pass_form").hide("fast", function() {
      $("#input").css("padding-top", "10px");
      $("#input").css("padding-bottom", "10px");
      $("#input").css("text-align", "left");
      $("#verify").show("fast");
      var parameters = { pass: $("#pass").val() };

      var success = function(data, _, xhr) {
        var listSize,
      html = "";
    data.forEach(function(entry) {
      html += "<p class='acct'>" + entry + "</p>";
    });
    listSize = data.length * 1.5;
    if (listSize > 12) {
      $("#accounts").css("height", '12em');
    }
    $("#accounts").html(html);
    $("#verify").hide("fast");
    $("#acct_div").show("fast");
    csrfToken = xhr.getResponseHeader('X-CSRF-TOKEN');
      };

      send_ajax_post('/session/secure/list', parameters, success);
    });
  };

  $("#pass").keypress(function (e) {
    if (e.which == 13) {
      pass_submit();
      return false;
    }
  });

  $("#pass_form .form_button").click(function() {
    pass_submit();
  });

  $("#accounts").on('click', '.acct', function() {
    var html = "";
    var index = $(".acct").index(this);
    var acct = $(".acct").eq(index).text();
    var parameters = { index: index };
    var success = function(data, _, xhr) {
      $("#accounts").hide();
      html += "<tr><td>Username:</td><td class='td_body'>" + data.username + "</td></tr>";
      html += "<tr><td>Password:</td><td class='td_body'>" + data.password +"</td></tr>";
      html += "<tr><td>Notes:</td><td class='td_body'>" + data.notes + "</td></tr>";
      $("#acct_div acct_headline").text(acct);
      $("#acct_div #acct_table").html(html).show();
      csrfToken = xhr.getResponseHeader('X-CSRF-TOKEN');
    };
    send_ajax_post('/session/secure/show', parameters, success);
  });
});

