//! Handler stubs for OCPP 1.6J CALLs initiated by the edge server and sent to
//! a charger. The transport and CALLRESULT/CALLERROR correlation will be
//! connected when outbound command handling is implemented.

use rust_ocpp::v1_6::messages;

pub fn handle_cancel_reservation(_request: messages::cancel_reservation::CancelReservationRequest) {
}
pub fn handle_change_availability(
    _request: messages::change_availability::ChangeAvailabilityRequest,
) {
}
pub fn handle_change_configuration(
    _request: messages::change_configuration::ChangeConfigurationRequest,
) {
}
pub fn handle_clear_cache(_request: messages::clear_cache::ClearCacheRequest) {}
pub fn handle_clear_charging_profile(
    _request: messages::clear_charging_profile::ClearChargingProfileRequest,
) {
}
pub fn handle_data_transfer(_request: messages::data_transfer::DataTransferRequest) {}
pub fn handle_get_composite_schedule(
    _request: messages::get_composite_schedule::GetCompositeScheduleRequest,
) {
}
pub fn handle_get_configuration(_request: messages::get_configuration::GetConfigurationRequest) {}
pub fn handle_get_diagnostics(_request: messages::get_diagnostics::GetDiagnosticsRequest) {}
pub fn handle_get_local_list_version(
    _request: messages::get_local_list_version::GetLocalListVersionRequest,
) {
}
pub fn handle_remote_start_transaction(
    _request: messages::remote_start_transaction::RemoteStartTransactionRequest,
) {
}
pub fn handle_remote_stop_transaction(
    _request: messages::remote_stop_transaction::RemoteStopTransactionRequest,
) {
}
pub fn handle_reserve_now(_request: messages::reserve_now::ReserveNowRequest) {}
pub fn handle_reset(_request: messages::reset::ResetRequest) {}
pub fn handle_send_local_list(_request: messages::send_local_list::SendLocalListRequest) {}
pub fn handle_set_charging_profile(
    _request: messages::set_charging_profile::SetChargingProfileRequest,
) {
}
pub fn handle_trigger_message(_request: messages::trigger_message::TriggerMessageRequest) {}
pub fn handle_unlock_connector(_request: messages::unlock_connector::UnlockConnectorRequest) {}
pub fn handle_update_firmware(_request: messages::update_firmware::UpdateFirmwareRequest) {}
